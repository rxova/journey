import { describe, expect, it, vi } from "vitest";

import {
  createGraphJourney,
  createGraphJourneyBuilder,
  createJourneyMachine,
  createLinearJourney,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = "start" | "loading" | "done" | "failed";
type Context = { result: string | null; error: string | null };

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const baseDefinition = (
  effect: NonNullable<JourneyDefinition<Context, StepId>["steps"]["loading"]["effect"]>,
  extraLoadingEvents: Record<string, unknown> = {}
): JourneyDefinition<Context, StepId> => ({
  initial: "start",
  context: { result: null, error: null },
  steps: {
    start: {},
    loading: { effect },
    done: {},
    failed: {}
  },
  transitions: {
    start: { goToNextStep: [{ to: "loading" }] },
    loading: extraLoadingEvents,
    done: {},
    failed: {}
  }
});

describe("step effects", () => {
  it("runs an effect on entry and routes the resolved output into context", async () => {
    const machine = createJourneyMachine(
      baseDefinition({
        run: async () => "loaded-data",
        onResolved: {
          to: "done",
          updateContext: ({ context, output }) => ({ ...context, result: output as string })
        },
        onRejected: { to: "failed" }
      })
    );

    await machine.startJourney();
    await machine.goToNextStep();

    await vi.waitFor(() => {
      expect(machine.getSnapshot().currentStepId).toBe("done");
    });
    expect(machine.getSnapshot().context.result).toBe("loaded-data");
  });

  it("routes a rejected effect to onRejected with the error", async () => {
    const machine = createJourneyMachine(
      baseDefinition({
        run: async () => {
          throw new Error("boom");
        },
        onResolved: { to: "done" },
        onRejected: {
          to: "failed",
          updateContext: ({ context, error }) => ({
            ...context,
            error: (error as Error).message
          })
        }
      })
    );

    await machine.startJourney();
    await machine.goToNextStep();

    await vi.waitFor(() => {
      expect(machine.getSnapshot().currentStepId).toBe("failed");
    });
    expect(machine.getSnapshot().context.error).toBe("boom");
  });

  it("does not surface internal synthetic effect events on the observation stream", async () => {
    const machine = createJourneyMachine(
      baseDefinition({
        run: async () => "loaded-data",
        onResolved: { to: "done" },
        onRejected: { to: "failed" }
      })
    );

    const syntheticObservations: unknown[] = [];
    const enteredSteps: string[] = [];
    machine.subscribeEvent((event) => {
      if (event.type === "step.enter") {
        enteredSteps.push(event.stepId);
      }
      if (event.type === "transition.start" && event.event.type.startsWith("@@journey.")) {
        syntheticObservations.push(event);
      }
      if (
        (event.type === "transition.success" || event.type === "transition.error") &&
        event.eventType.startsWith("@@journey.")
      ) {
        syntheticObservations.push(event);
      }
    });

    await machine.startJourney();
    await machine.goToNextStep(); // start → loading; the effect then routes to done

    await vi.waitFor(() => {
      expect(machine.getSnapshot().currentStepId).toBe("done");
    });

    // The internal effect-resolved transition is filtered from the stream…
    expect(syntheticObservations).toEqual([]);
    // …but the real navigation it produced is still observable.
    expect(enteredSteps).toContain("done");
  });

  it("reports an invoking async phase while the effect is in flight", async () => {
    const gate = deferred<string>();
    const machine = createJourneyMachine(
      baseDefinition({
        run: () => gate.promise,
        onResolved: { to: "done" }
      })
    );

    await machine.startJourney();
    await machine.goToNextStep();

    await vi.waitFor(() => {
      expect(machine.getSnapshot().async.byStep.loading.phase).toBe("invoking");
    });
    expect(machine.getSnapshot().async.isLoading).toBe(true);

    gate.resolve("ok");
    await vi.waitFor(() => {
      expect(machine.getSnapshot().currentStepId).toBe("done");
    });
    expect(machine.getSnapshot().async.isLoading).toBe(false);
  });

  it("runs the initial step's effect on startJourney", async () => {
    const machine = createJourneyMachine<Context, StepId>({
      initial: "loading",
      context: { result: null, error: null },
      steps: {
        start: {},
        loading: {
          effect: {
            run: async () => "from-start",
            onResolved: {
              to: "done",
              updateContext: ({ context, output }) => ({ ...context, result: output as string })
            }
          }
        },
        done: {},
        failed: {}
      },
      transitions: { start: {}, loading: {}, done: {}, failed: {} }
    });

    await machine.startJourney();

    await vi.waitFor(() => {
      expect(machine.getSnapshot().currentStepId).toBe("done");
    });
    expect(machine.getSnapshot().context.result).toBe("from-start");
  });

  it("cancels the in-flight effect when the machine is reset", async () => {
    const gate = deferred<string>();
    let aborted = false;
    const machine = createJourneyMachine(
      baseDefinition({
        run: ({ signal }) => {
          signal.addEventListener("abort", () => {
            aborted = true;
          });
          return gate.promise;
        },
        onResolved: { to: "done" }
      })
    );

    await machine.startJourney();
    await machine.goToNextStep();
    await vi.waitFor(() => {
      expect(machine.getSnapshot().async.byStep.loading.phase).toBe("invoking");
    });

    await machine.resetJourney();
    expect(aborted).toBe(true);

    gate.resolve("late");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(machine.getSnapshot().currentStepId).toBe("start");
    expect(machine.getSnapshot().status).toBe("idled");
  });

  it("cancels the effect when the step is left before it settles", async () => {
    const gate = deferred<string>();
    let aborted = false;
    const machine = createJourneyMachine(
      baseDefinition(
        {
          run: ({ signal }) => {
            signal.addEventListener("abort", () => {
              aborted = true;
            });
            return gate.promise;
          },
          onResolved: { to: "done" }
        },
        { goToPreviousStep: [{ to: "start" }] }
      )
    );

    await machine.startJourney();
    await machine.goToNextStep();
    await vi.waitFor(() => {
      expect(machine.getSnapshot().async.byStep.loading.phase).toBe("invoking");
    });

    await machine.send({ type: "goToPreviousStep" });
    expect(aborted).toBe(true);

    gate.resolve("late");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(machine.getSnapshot().currentStepId).toBe("start");
  });

  it("rejects with a timeout error when the effect exceeds timeoutMs", async () => {
    const machine = createJourneyMachine(
      baseDefinition({
        run: () => new Promise<string>(() => undefined),
        timeoutMs: 10,
        onResolved: { to: "done" },
        onRejected: {
          to: "failed",
          updateContext: ({ context, error }) => ({
            ...context,
            error: (error as Error).name
          })
        }
      })
    );

    await machine.startJourney();
    await machine.goToNextStep();

    await vi.waitFor(() => {
      expect(machine.getSnapshot().currentStepId).toBe("failed");
    });
    expect(machine.getSnapshot().context.error).toBe("JourneyTimeoutError");
  });

  it("settles to idle when an effect resolves without an onResolved branch", async () => {
    const machine = createJourneyMachine(
      baseDefinition({
        run: async () => "ignored"
      })
    );

    await machine.startJourney();
    await machine.goToNextStep();

    await vi.waitFor(() => {
      expect(machine.getSnapshot().async.byStep.loading.phase).toBe("idle");
    });
    expect(machine.getSnapshot().currentStepId).toBe("loading");
  });

  it("sets an error phase when an effect rejects without an onRejected branch", async () => {
    const machine = createJourneyMachine(
      baseDefinition({
        run: async () => {
          throw new Error("unhandled");
        }
      })
    );

    await machine.startJourney();
    await machine.goToNextStep();

    await vi.waitFor(() => {
      expect(machine.getSnapshot().async.byStep.loading.phase).toBe("error");
    });
    expect(machine.getSnapshot().currentStepId).toBe("loading");
  });

  it("ignores effects in headless mode", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const machine = createJourneyMachine<Context, StepId>({
      initial: "loading",
      context: { result: null, error: null },
      steps: {
        start: {},
        loading: {
          effect: { run: async () => "x", onResolved: { to: "done" } }
        },
        done: {},
        failed: {}
      }
    });

    await machine.startJourney();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(machine.getSnapshot().currentStepId).toBe("loading");
    warn.mockRestore();
  });
});

describe("step effects via the builder and linear factory", () => {
  it("infers the effect output type in the builder and routes it into context", async () => {
    type BStep = "start" | "loading" | "done";
    type BContext = { name: string };

    const { createStep, to, build } = createGraphJourneyBuilder<{
      context: BContext;
      stepId: BStep;
    }>();
    const machine = createGraphJourney(
      build({
        initial: "start",
        context: { name: "" },
        steps: [
          createStep("start", { on: { goToNextStep: [to("loading")] } }),
          createStep("loading", {
            effect: {
              run: async () => ({ name: "ada" }),
              // `output` is inferred as { name: string } — no cast needed.
              onResolved: {
                to: "done",
                updateContext: ({ context, output }) => ({ ...context, name: output.name })
              }
            }
          }),
          createStep("done", {})
        ]
      })
    );

    await machine.startJourney();
    await machine.goToNextStep();

    await vi.waitFor(() => {
      expect(machine.getSnapshot().currentStepId).toBe("done");
    });
    expect(machine.getSnapshot().context.name).toBe("ada");
  });

  it("runs effects on linear steps", async () => {
    type LStep = "intro" | "fetch" | "ready";
    type LContext = { token: string | null };

    const machine = createLinearJourney<LContext, LStep>({
      context: { token: null },
      steps: [
        "intro",
        {
          id: "fetch",
          effect: {
            run: async () => "tok-123",
            onResolved: {
              to: "ready",
              updateContext: ({ context, output }) => ({ ...context, token: output as string })
            }
          }
        },
        "ready"
      ]
    });

    await machine.startJourney();
    await machine.goToNextStep();

    await vi.waitFor(() => {
      expect(machine.getSnapshot().currentStepId).toBe("ready");
    });
    expect(machine.getSnapshot().context.token).toBe("tok-123");
  });
});

describe("step effects — disposal and interactions", () => {
  type IStep = "start" | "both" | "fromEffect" | "fromAfter" | "skipped";
  type IContext = { tag: string | null };
  type IEvents = { skip: undefined };

  it("aborts a pending effect on dispose", async () => {
    const { promise } = deferred<string>();
    let aborted = false;

    const machine = createJourneyMachine(
      baseDefinition({
        run: ({ signal }) => {
          signal.addEventListener("abort", () => {
            aborted = true;
          });
          return promise;
        },
        onResolved: { to: "done" }
      })
    );

    await machine.startJourney();
    await machine.goToNextStep(); // → loading, effect in flight
    expect(machine.getSnapshot().async.byStep.loading.phase).toBe("invoking");

    machine.dispose();
    expect(aborted).toBe(true);
  });

  it("after + effect on one step: the effect wins when it settles first", async () => {
    const def: JourneyDefinition<IContext, IStep, IEvents> = {
      initial: "start",
      context: { tag: null },
      steps: {
        start: {},
        both: {
          effect: { run: async () => "ok", onResolved: { to: "fromEffect" } },
          after: { 1000: { to: "fromAfter" } }
        },
        fromEffect: {},
        fromAfter: {},
        skipped: {}
      },
      transitions: {
        start: { goToNextStep: [{ to: "both" }] },
        both: {},
        fromEffect: {},
        fromAfter: {},
        skipped: {}
      }
    };

    const machine = createJourneyMachine(def);
    await machine.startJourney();
    await machine.goToNextStep();

    await vi.waitFor(() => {
      expect(machine.getSnapshot().currentStepId).toBe("fromEffect");
    });
    // The 1000ms timer was cancelled when the effect routed away.
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(machine.getSnapshot().currentStepId).toBe("fromEffect");
  });

  it("after + effect on one step: a short after preempts a slow effect and cancels it", async () => {
    const { promise } = deferred<string>();
    let aborted = false;

    const def: JourneyDefinition<IContext, IStep, IEvents> = {
      initial: "start",
      context: { tag: null },
      steps: {
        start: {},
        both: {
          effect: {
            run: ({ signal }) => {
              signal.addEventListener("abort", () => {
                aborted = true;
              });
              return promise;
            },
            onResolved: { to: "fromEffect" }
          },
          after: { 20: { to: "fromAfter" } }
        },
        fromEffect: {},
        fromAfter: {},
        skipped: {}
      },
      transitions: {
        start: { goToNextStep: [{ to: "both" }] },
        both: {},
        fromEffect: {},
        fromAfter: {},
        skipped: {}
      }
    };

    const machine = createJourneyMachine(def);
    await machine.startJourney();
    await machine.goToNextStep();

    await vi.waitFor(() => {
      expect(machine.getSnapshot().currentStepId).toBe("fromAfter");
    });
    expect(aborted).toBe(true);
  });

  it("an onEnter dispatch navigates away from a step with a pending effect, cancelling it", async () => {
    const { promise } = deferred<string>();
    let aborted = false;

    const def: JourneyDefinition<IContext, IStep, IEvents> = {
      initial: "start",
      context: { tag: null },
      steps: {
        start: {},
        both: {
          onEnter: ({ dispatch }) => {
            dispatch({ type: "skip" });
          },
          effect: {
            run: ({ signal }) => {
              signal.addEventListener("abort", () => {
                aborted = true;
              });
              return promise;
            },
            onResolved: { to: "fromEffect" }
          }
        },
        fromEffect: {},
        fromAfter: {},
        skipped: {}
      },
      transitions: {
        start: { goToNextStep: [{ to: "both" }] },
        both: { skip: [{ to: "skipped" }] },
        fromEffect: {},
        fromAfter: {},
        skipped: {}
      }
    };

    const machine = createJourneyMachine(def);
    await machine.startJourney();
    await machine.goToNextStep(); // → both; onEnter dispatches skip, effect is pending

    await vi.waitFor(() => {
      expect(machine.getSnapshot().currentStepId).toBe("skipped");
    });
    expect(aborted).toBe(true);
  });
});
