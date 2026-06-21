import { describe, expect, it, vi } from "vitest";

import {
  createGraphJourney,
  createGraphJourneyBuilder,
  createJourneyMachine,
  createLinearJourney,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = "start" | "waiting" | "next" | "elsewhere";
type Context = { advancedBy: string | null };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("after (delayed transitions)", () => {
  it("transitions automatically once the delay elapses", async () => {
    const def: JourneyDefinition<Context, StepId> = {
      initial: "start",
      context: { advancedBy: null },
      steps: {
        start: {},
        waiting: { after: { 20: { to: "next" } } },
        next: {},
        elsewhere: {}
      },
      transitions: {
        start: { goToNextStep: [{ to: "waiting" }] },
        waiting: {},
        next: {},
        elsewhere: {}
      }
    };

    const machine = createJourneyMachine(def);
    await machine.startJourney();
    await machine.goToNextStep();

    expect(machine.getSnapshot().currentStepId).toBe("waiting");
    await vi.waitFor(() => {
      expect(machine.getSnapshot().currentStepId).toBe("next");
    });
  });

  it("runs the delayed branch's updateContext", async () => {
    const def: JourneyDefinition<Context, StepId> = {
      initial: "waiting",
      context: { advancedBy: null },
      steps: {
        start: {},
        waiting: {
          after: {
            20: {
              to: "next",
              updateContext: ({ context }) => ({ ...context, advancedBy: "timer" })
            }
          }
        },
        next: {},
        elsewhere: {}
      },
      transitions: { start: {}, waiting: {}, next: {}, elsewhere: {} }
    };

    const machine = createJourneyMachine(def);
    await machine.startJourney();

    await vi.waitFor(() => {
      expect(machine.getSnapshot().currentStepId).toBe("next");
    });
    expect(machine.getSnapshot().context.advancedBy).toBe("timer");
  });

  it("cancels the timer when the step is left before it fires", async () => {
    const def: JourneyDefinition<Context, StepId> = {
      initial: "start",
      context: { advancedBy: null },
      steps: {
        start: {},
        waiting: { after: { 1000: { to: "next" } } },
        next: {},
        elsewhere: {}
      },
      transitions: {
        start: { goToNextStep: [{ to: "waiting" }] },
        waiting: { goToStepById: [{ to: "elsewhere" }] },
        next: {},
        elsewhere: {}
      }
    };

    const machine = createJourneyMachine(def);
    await machine.startJourney();
    await machine.goToNextStep();
    await machine.goToStepById("elsewhere");

    expect(machine.getSnapshot().currentStepId).toBe("elsewhere");
    await sleep(40);
    // The 1000ms timer must not fire after we've left "waiting".
    expect(machine.getSnapshot().currentStepId).toBe("elsewhere");
  });

  it("cancels the timer on reset", async () => {
    const def: JourneyDefinition<Context, StepId> = {
      initial: "waiting",
      context: { advancedBy: null },
      steps: {
        start: {},
        waiting: { after: { 1000: { to: "next" } } },
        next: {},
        elsewhere: {}
      },
      transitions: { start: {}, waiting: {}, next: {}, elsewhere: {} }
    };

    const machine = createJourneyMachine(def);
    await machine.startJourney();
    await machine.resetJourney();

    await sleep(40);
    expect(machine.getSnapshot().status).toBe("idled");
    expect(machine.getSnapshot().currentStepId).toBe("waiting");
  });

  it("fires the earliest of multiple delays on one step and cancels the longer one", async () => {
    const def: JourneyDefinition<Context, StepId> = {
      initial: "waiting",
      context: { advancedBy: null },
      steps: {
        start: {},
        waiting: {
          after: {
            60: { to: "elsewhere" },
            20: { to: "next" }
          }
        },
        next: {},
        elsewhere: {}
      },
      transitions: { start: {}, waiting: {}, next: {}, elsewhere: {} }
    };

    const machine = createJourneyMachine(def);
    await machine.startJourney();

    await vi.waitFor(() => {
      expect(machine.getSnapshot().currentStepId).toBe("next");
    });

    // Leaving "waiting" via the 20ms timer cancels the 60ms timer.
    await sleep(80);
    expect(machine.getSnapshot().currentStepId).toBe("next");
  });

  it("cancels a pending after timer on dispose", async () => {
    const def: JourneyDefinition<Context, StepId> = {
      initial: "waiting",
      context: { advancedBy: null },
      steps: {
        start: {},
        waiting: { after: { 30: { to: "next" } } },
        next: {},
        elsewhere: {}
      },
      transitions: { start: {}, waiting: {}, next: {}, elsewhere: {} }
    };

    const machine = createJourneyMachine(def);
    await machine.startJourney();
    expect(machine.getSnapshot().currentStepId).toBe("waiting");

    machine.dispose();
    await sleep(60);

    // The timer must not fire after dispose.
    expect(machine.getSnapshot().currentStepId).toBe("waiting");
  });

  it("works through the builder and the linear factory", async () => {
    type BStep = "splash" | "home";
    const { createStep, build } = createGraphJourneyBuilder<{ seen: boolean }, BStep>();
    const graph = createGraphJourney(
      build({
        initial: "splash",
        context: { seen: false },
        steps: [
          createStep("splash", {
            after: {
              20: { to: "home", updateContext: ({ context }) => ({ ...context, seen: true }) }
            }
          }),
          createStep("home", {})
        ]
      })
    );
    await graph.startJourney();
    await vi.waitFor(() => {
      expect(graph.getSnapshot().currentStepId).toBe("home");
    });
    expect(graph.getSnapshot().context.seen).toBe(true);

    const linear = createLinearJourney<{ x: number }, "a" | "b" | "c">({
      context: { x: 0 },
      steps: ["a", { id: "b", after: { 20: { to: "c" } } }, "c"]
    });
    await linear.startJourney();
    await linear.goToNextStep(); // a -> b (timer starts)
    await vi.waitFor(() => {
      expect(linear.getSnapshot().currentStepId).toBe("c");
    });
  });
});
