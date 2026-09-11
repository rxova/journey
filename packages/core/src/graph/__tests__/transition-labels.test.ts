import { describe, expect, it, vi } from "vitest";
import { createGraphJourney, JourneyError } from "@rxova/journey-core";
import type { JourneyPlugin, JourneyStructure } from "@rxova/journey-core";
import { flush, wait } from "@rxova/journey-core/testing";

type Ctx = { readonly tier: "free" | "paid" };

/**
 * Two candidates on one event, differing only by guard — the case a priority
 * index describes but does not explain.
 */
const checkout = (tier: Ctx["tier"], onEnter?: (label: string | null) => void) =>
  createGraphJourney({
    initial: "checkout",
    context: { tier } as Ctx,
    steps: {
      checkout: {
        on: {
          PAY: [
            { to: "review", label: "needs-review", when: ({ context }) => context.tier === "free" },
            { to: "done", label: "straight-through" }
          ]
        }
      },
      review: { onEnter: ({ transition }) => onEnter?.(transition?.label ?? null) },
      done: { onEnter: ({ transition }) => onEnter?.(transition?.label ?? null) }
    }
  });

describe("transition labels", () => {
  it("names the edge that fired in step hook args", async () => {
    const seen: (string | null)[] = [];
    const machine = checkout("paid", (label) => void seen.push(label));
    machine.controls.start();
    await flush();
    await machine.send("PAY");
    await flush();

    expect(machine.getSnapshot().currentStep?.id).toBe("done");
    expect(seen).toEqual(["straight-through"]);
  });

  it("distinguishes the guarded sibling that shares the event", async () => {
    const seen: (string | null)[] = [];
    const machine = checkout("free", (label) => void seen.push(label));
    machine.controls.start();
    await flush();
    await machine.send("PAY");
    await flush();

    expect(machine.getSnapshot().currentStep?.id).toBe("review");
    expect(seen).toEqual(["needs-review"]);
  });

  it("reports a null label and the declaration index for an anonymous edge", async () => {
    let info: unknown = "unset";
    const machine = createGraphJourney({
      initial: "a",
      context: {},
      steps: {
        a: { on: { GO: [{ to: "b", when: () => false }, { to: "b" }] } },
        b: { onEnter: (args) => void (info = args.transition) }
      }
    });
    machine.controls.start();
    await flush();
    await machine.send("GO");
    await flush();

    expect(info).toEqual({ event: "GO", from: "a", to: "b", label: null, index: 1 });
  });

  it("leaves `transition` null where no edge was taken", async () => {
    const seen: unknown[] = [];
    const machine = createGraphJourney({
      initial: "a",
      context: {},
      steps: {
        a: { on: { GO: "b" }, onEnter: (args) => void seen.push(args.transition) },
        b: {}
      }
    });
    machine.controls.start();
    await flush();
    await machine.send("GO");
    await flush();
    await machine.navigate.goToPreviousStep();
    await flush();

    // The initial entry, then the timeline move back onto `a`: neither is an edge.
    expect(seen).toEqual([null, null]);
  });

  it("carries label and index into the structure view plugins read", () => {
    let structure: JourneyStructure | null = null;
    const probe: JourneyPlugin = {
      name: "probe",
      setup: (host) => {
        structure = host.structure;
        return {};
      }
    };
    const machine = createGraphJourney(
      {
        initial: "checkout",
        context: { tier: "free" } as Ctx,
        steps: {
          checkout: {
            on: {
              PAY: [{ to: "review", label: "needs-review", when: () => true }, { to: "done" }]
            }
          },
          review: {},
          done: {}
        }
      },
      { autoStart: false, plugins: [probe] as const }
    );

    expect(machine.getSnapshot().status).toBe("idle");
    expect(structure!.transitions).toEqual([
      {
        event: "PAY",
        from: "checkout",
        to: "review",
        guarded: true,
        label: "needs-review",
        index: 0
      },
      { event: "PAY", from: "checkout", to: "done", guarded: false, label: null, index: 1 }
    ]);
  });

  it("names the edge in an onTransition timeout instead of just the event", async () => {
    vi.useFakeTimers();
    const errors: unknown[] = [];
    const machine = createGraphJourney(
      {
        initial: "a",
        context: {},
        steps: {
          a: { on: { GO: [{ to: "b", label: "slow-edge", onTransition: () => wait(5_000) }] } },
          b: {}
        }
      },
      { defaultTimeoutMs: 10 }
    );
    machine.subscriptions.subscribeEvent("error", ({ error }) => void errors.push(error));
    machine.controls.start();
    await vi.advanceTimersByTimeAsync(1);
    const moved = machine.send("GO");
    await vi.advanceTimersByTimeAsync(50);
    await moved;

    expect((errors[0] as Error).message).toContain("onTransition(slow-edge)");
    vi.useRealTimers();
  });

  it("falls back to event, index and endpoints when the edge is anonymous", async () => {
    vi.useFakeTimers();
    const errors: unknown[] = [];
    const machine = createGraphJourney(
      {
        initial: "a",
        context: {},
        steps: {
          a: { on: { GO: [{ to: "b", onTransition: () => wait(5_000) }] } },
          b: {}
        }
      },
      { defaultTimeoutMs: 10 }
    );
    machine.subscriptions.subscribeEvent("error", ({ error }) => void errors.push(error));
    machine.controls.start();
    await vi.advanceTimersByTimeAsync(1);
    const moved = machine.send("GO");
    await vi.advanceTimersByTimeAsync(50);
    await moved;

    expect((errors[0] as Error).message).toContain("onTransition(GO[0] (a -> b))");
    vi.useRealTimers();
  });

  it("rejects an empty or non-string label at build time", () => {
    const build = (label: unknown) =>
      createGraphJourney({
        initial: "a",
        context: {},
        steps: { a: { on: { GO: [{ to: "b", label: label as string }] } }, b: {} }
      });

    expect(() => build("")).toThrow(JourneyError);
    expect(() => build(42)).toThrow(/non-empty string/);
  });
});
