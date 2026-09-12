import { describe, expect, it, vi } from "vitest";
import { createGraphJourney, defineWork, JourneyError, withGraphTypes } from "@rxova/journey-core";
import { wait } from "@rxova/journey-core/testing";

type SlowBag = {
  context: Record<string, never>;
  stepId: "a" | "b";
  events: { type: "SLOW" } | { type: "FAST" };
};

/**
 * The point of a per-edge budget: one edge waits on something slow, the rest do
 * not, and the global default is not dragged out to the slow one's budget.
 */
describe("per-edge timeoutMs", () => {
  it("lets one edge's work outlast the global default", async () => {
    vi.useFakeTimers();
    const machine = withGraphTypes<SlowBag>()(
      {
        initial: "a",
        context: {},
        steps: {
          a: {
            on: {
              SLOW: defineWork<SlowBag, "SLOW">()({
                run: async () => {
                  await wait(500);
                  return "third-party";
                },
                timeoutMs: 5_000,
                candidates: [{ to: "b" }]
              })
            }
          },
          b: {}
        }
      },
      { defaultTimeoutMs: 50 }
    );
    machine.controls.start();
    await vi.advanceTimersByTimeAsync(1);

    const moved = machine.send("SLOW");
    await vi.advanceTimersByTimeAsync(1_000);

    expect(await moved).toMatchObject({ ok: true, to: "b" });
    vi.useRealTimers();
  });

  it("still bounds that edge at its own budget", async () => {
    vi.useFakeTimers();
    const machine = createGraphJourney(
      {
        initial: "a",
        context: {},
        steps: {
          a: {
            on: {
              SLOW: {
                run: async () => {
                  await wait(20_000);
                  return null;
                },
                label: "third-party-call",
                timeoutMs: 5_000,
                candidates: [{ to: "b" }]
              }
            }
          },
          b: {}
        }
      },
      { defaultTimeoutMs: 50 }
    );
    machine.controls.start();
    await vi.advanceTimersByTimeAsync(1);

    const moved = machine.send("SLOW");
    await vi.advanceTimersByTimeAsync(30_000);
    const result = await moved;

    expect(result).toMatchObject({ ok: false, reason: "error" });
    expect((result as { error: Error }).error.message).toContain(
      "send work(third-party-call) timed out after 5000ms"
    );
    vi.useRealTimers();
  });

  it("leaves every other edge on the global default", async () => {
    vi.useFakeTimers();
    const machine = createGraphJourney(
      {
        initial: "a",
        context: {},
        steps: {
          a: {
            on: {
              SLOW: {
                run: () => wait(500),
                timeoutMs: 5_000,
                candidates: [{ to: "b" }]
              },
              FAST: {
                run: () => wait(500),
                label: "should-have-been-quick",
                candidates: [{ to: "b" }]
              }
            }
          },
          b: {}
        }
      },
      { defaultTimeoutMs: 50 }
    );
    machine.controls.start();
    await vi.advanceTimersByTimeAsync(1);

    const moved = machine.send("FAST");
    await vi.advanceTimersByTimeAsync(1_000);
    const result = await moved;

    expect(result).toMatchObject({ ok: false, reason: "error" });
    expect((result as { error: Error }).error.message).toContain("timed out after 50ms");
    vi.useRealTimers();
  });

  it("bounds a single edge's onTransition without touching its siblings", async () => {
    vi.useFakeTimers();
    const errors: Error[] = [];
    const machine = createGraphJourney(
      {
        initial: "a",
        context: { slow: true } as { slow: boolean },
        steps: {
          a: {
            on: {
              GO: [
                {
                  to: "b",
                  label: "slow-notify",
                  timeoutMs: 5_000,
                  when: ({ context }) => context.slow,
                  onTransition: () => wait(500)
                },
                { to: "b", label: "quick", onTransition: () => wait(500) }
              ]
            }
          },
          b: {}
        }
      },
      { defaultTimeoutMs: 50 }
    );
    machine.subscriptions.subscribeEvent("error", ({ error }) => void errors.push(error as Error));
    machine.controls.start();
    await vi.advanceTimersByTimeAsync(1);

    const moved = machine.send("GO");
    await vi.advanceTimersByTimeAsync(1_000);
    await moved;

    // The chosen edge declared 5s for its own 500ms effect, so nothing timed out.
    expect(errors).toEqual([]);
    expect(machine.getSnapshot().currentStep?.id).toBe("b");
    vi.useRealTimers();
  });

  it("applies to caller-supplied navigation work too", async () => {
    vi.useFakeTimers();
    const machine = createGraphJourney(
      { initial: "a", context: {}, steps: { a: { on: { GO: "b" } }, b: {} } },
      { defaultTimeoutMs: 50 }
    );
    machine.controls.start();
    await vi.advanceTimersByTimeAsync(1);
    await machine.send("GO");
    await vi.advanceTimersByTimeAsync(1);
    await machine.navigate.goToPreviousStep();
    await vi.advanceTimersByTimeAsync(1);

    const moved = machine.navigate.goToNextStep({
      run: async () => {
        await wait(500);
        return "slow";
      },
      timeoutMs: 5_000
    });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(await moved).toMatchObject({ ok: true, to: "b" });
    vi.useRealTimers();
  });

  it("rejects a non-positive or non-finite budget at build time", () => {
    const build = (timeoutMs: unknown) =>
      createGraphJourney({
        initial: "a",
        context: {},
        steps: {
          a: { on: { GO: [{ to: "b", timeoutMs: timeoutMs as number }] } },
          b: {}
        }
      });

    expect(() => build(0)).toThrow(JourneyError);
    expect(() => build(-1)).toThrow(/greater than 0/);
    expect(() => build(Number.POSITIVE_INFINITY)).toThrow(/finite number/);
    expect(() => build("2s")).toThrow(/finite number/);
  });

  it("rejects a bad budget declared on work, naming the event and step", () => {
    expect(() =>
      createGraphJourney({
        initial: "a",
        context: {},
        steps: {
          a: { on: { GO: { run: () => null, timeoutMs: -5, candidates: [{ to: "b" }] } } },
          b: {}
        }
      })
    ).toThrow(/work on "GO" on step "a"/);
  });
});
