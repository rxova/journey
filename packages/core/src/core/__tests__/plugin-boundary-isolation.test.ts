import { describe, expect, it, vi } from "vitest";
import { createLinearJourney } from "@rxova/journey-core";
import { flush } from "@rxova/journey-core/testing";
import type { JourneyPlugin } from "@rxova/journey-core";

/**
 * `setup()` and `deriveSnapshot` are the two plugin entry points the runtime
 * used to call unguarded. Every other tap was already isolated, so a single
 * misbehaving third-party plugin could either leak the resources of the
 * plugins registered before it, or take down every transition.
 */

const disposingPlugin = (
  name: string,
  onDispose: () => void
): JourneyPlugin<string, Record<string, never>> => ({
  name,
  setup(host) {
    host.onDispose(onDispose);
    return { api: {} };
  }
});

describe("a throwing plugin setup()", () => {
  it("disposes the plugins registered before it", () => {
    const disposed = vi.fn();
    const exploding: JourneyPlugin<"boom", never> = {
      name: "boom",
      setup() {
        throw new Error("setup failed");
      }
    };

    expect(() =>
      createLinearJourney(
        { steps: ["a"], context: {} },
        { plugins: [disposingPlugin("good", disposed), exploding] as const }
      )
    ).toThrow(/setup failed/);

    // Construction failed, so the machine is never returned and dispose() is
    // unreachable to the caller — the runtime has to run teardown itself.
    expect(disposed).toHaveBeenCalledTimes(1);
  });

  it("disposes earlier plugins when a duplicate name is rejected", () => {
    const disposed = vi.fn();

    expect(() =>
      createLinearJourney(
        { steps: ["a"], context: {} },
        {
          plugins: [
            disposingPlugin("dup", disposed),
            disposingPlugin("dup", () => undefined)
          ] as const
        }
      )
    ).toThrow(/duplicate plugin name "dup"/);

    expect(disposed).toHaveBeenCalledTimes(1);
  });
});

describe("a throwing deriveSnapshot", () => {
  it("does not break construction or transitions, and reports the failure", async () => {
    const reported: unknown[] = [];
    const failure = new Error("derive failed");
    const badDeriver: JourneyPlugin<"bad", Record<string, never>, unknown> = {
      name: "bad",
      setup: () => ({
        api: {},
        deriveSnapshot: () => {
          throw failure;
        }
      })
    };

    const machine = createLinearJourney(
      { steps: ["a", "b", "c"], context: { n: 0 } },
      { plugins: [badDeriver] as const, onListenerError: (error) => reported.push(error) }
    );
    machine.controls.start();
    await flush();

    const moved = await machine.navigate.goToNextStep();

    expect(moved.ok).toBe(true);
    expect(machine.getSnapshot().currentStep?.id).toBe("b");
    expect(reported).toContain(failure);
  });

  it("carries the previous slice forward instead of blinking to undefined", async () => {
    let shouldThrow = false;
    const flaky: JourneyPlugin<"flaky", Record<string, never>, { seen: number }> = {
      name: "flaky",
      setup: () => {
        let seen = 0;
        return {
          api: {},
          deriveSnapshot: () => {
            if (shouldThrow) throw new Error("nope");
            seen += 1;
            return { seen };
          }
        };
      }
    };

    const machine = createLinearJourney(
      { steps: ["a", "b", "c"], context: {} },
      { plugins: [flaky] as const, onListenerError: () => undefined }
    );
    machine.controls.start();
    await flush();

    const before = machine.getSnapshot().plugins.flaky;
    expect(before).toBeDefined();

    shouldThrow = true;
    await machine.navigate.goToNextStep();

    expect(machine.getSnapshot().plugins.flaky).toEqual(before);
  });

  it("keeps other plugins' slices intact when one deriver throws", async () => {
    const good: JourneyPlugin<"good", Record<string, never>, { ok: boolean }> = {
      name: "good",
      setup: () => ({ api: {}, deriveSnapshot: () => ({ ok: true }) })
    };
    const bad: JourneyPlugin<"bad", Record<string, never>, unknown> = {
      name: "bad",
      setup: () => ({
        api: {},
        deriveSnapshot: () => {
          throw new Error("nope");
        }
      })
    };

    const machine = createLinearJourney(
      { steps: ["a", "b"], context: {} },
      { plugins: [good, bad] as const, onListenerError: () => undefined }
    );
    machine.controls.start();
    await flush();

    expect(machine.getSnapshot().plugins.good).toEqual({ ok: true });
  });
});
