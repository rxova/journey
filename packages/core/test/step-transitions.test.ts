import { describe, expect, it } from "vitest";

import { createJourneyMachine } from "@rxova/journey-core";

type StepId = "welcome" | "verify" | "dashboard" | "blocked";
type EventMap = { requestClose: unknown };
type Context = { needsVerification: boolean; count: number };

const startJourney = <T extends { start: () => unknown }>(machine: T): T => {
  machine.start();
  return machine;
};

describe("graph transitions", () => {
  it("supports journeys defined entirely inside steps", async () => {
    const machine = startJourney(
      createJourneyMachine<Context, StepId, EventMap>({
        initial: "welcome",
        context: { needsVerification: false, count: 0 },
        steps: {
          welcome: {},
          verify: {},
          dashboard: {},
          blocked: {}
        },
        transitions: {
          welcome: { goToNextStep: [{ to: "dashboard" }] },
          dashboard: { goToNextStep: [{ to: "COMPLETE" }] }
        }
      })
    );

    await machine.send({ type: "goToNextStep" });
    expect(machine.getSnapshot().currentStepId).toBe("dashboard");

    await machine.send({ type: "goToNextStep" });
    expect(machine.getSnapshot().status).toBe("completed");
  });

  it("supports terminal targets from step-local transitions", async () => {
    const completeMachine = startJourney(
      createJourneyMachine<Context, StepId, EventMap>({
        initial: "welcome",
        context: { needsVerification: false, count: 0 },
        steps: {
          welcome: {},
          verify: {},
          dashboard: {},
          blocked: {}
        },
        transitions: {
          welcome: { goToNextStep: [{ to: "COMPLETE" }] }
        }
      })
    );

    await completeMachine.send({ type: "goToNextStep" });
    expect(completeMachine.getSnapshot().status).toBe("completed");

    const terminatedMachine = startJourney(
      createJourneyMachine<Context, StepId, EventMap>({
        initial: "welcome",
        context: { needsVerification: false, count: 0 },
        steps: {
          welcome: {},
          verify: {},
          dashboard: {},
          blocked: {}
        },
        transitions: {
          welcome: { requestClose: [{ to: "TERMINATED" }] }
        }
      })
    );

    await terminatedMachine.send({ type: "requestClose" });
    expect(terminatedMachine.getSnapshot().status).toBe("terminated");
  });

  it("keeps first-match-wins semantics for guarded branches", async () => {
    const machine = startJourney(
      createJourneyMachine<Context, StepId, EventMap>({
        initial: "welcome",
        context: { needsVerification: true, count: 0 },
        steps: {
          welcome: {},
          verify: {},
          dashboard: {},
          blocked: {}
        },
        transitions: {
          welcome: {
            goToNextStep: [
              { when: ({ context }) => context.needsVerification, to: "verify" },
              { to: "dashboard" }
            ]
          }
        }
      })
    );

    await machine.send({ type: "goToNextStep" });
    expect(machine.getSnapshot().currentStepId).toBe("verify");
  });

  it("falls through to later branches when earlier guards fail", async () => {
    const machine = startJourney(
      createJourneyMachine<Context, StepId, EventMap>({
        initial: "welcome",
        context: { needsVerification: false, count: 0 },
        steps: {
          welcome: {},
          verify: {},
          dashboard: {},
          blocked: {}
        },
        transitions: {
          welcome: {
            goToNextStep: [
              { when: ({ context }) => context.needsVerification, to: "verify" },
              { to: "dashboard" }
            ]
          }
        }
      })
    );

    await machine.send({ type: "goToNextStep" });
    expect(machine.getSnapshot().currentStepId).toBe("dashboard");
  });

  it("applies wildcard globals as cross-cutting transitions", async () => {
    const machine = startJourney(
      createJourneyMachine<Context, StepId, EventMap>({
        initial: "welcome",
        context: { needsVerification: false, count: 0 },
        steps: {
          welcome: {},
          verify: {},
          dashboard: {},
          blocked: {}
        },
        transitions: {
          welcome: { goToNextStep: [{ to: "dashboard" }] },
          global: { goToNextStep: [{ to: "blocked", when: () => true }] }
        }
      })
    );

    await machine.send({ type: "goToNextStep" });
    expect(machine.getSnapshot().currentStepId).toBe("blocked");
  });

  it("falls through to wildcard globals when a step declares no matching edge", async () => {
    const machine = startJourney(
      createJourneyMachine<Context, StepId, EventMap>({
        initial: "welcome",
        context: { needsVerification: false, count: 0 },
        steps: {
          welcome: {},
          verify: {},
          dashboard: {},
          blocked: {}
        },
        transitions: {
          global: { goToNextStep: [{ to: "dashboard" }] }
        }
      })
    );

    await machine.send({ type: "goToNextStep" });
    expect(machine.getSnapshot().currentStepId).toBe("dashboard");
  });

  it("passes effect context and transition ids through step-local edges", async () => {
    const machine = startJourney(
      createJourneyMachine<Context, StepId, EventMap>({
        initial: "welcome",
        context: { needsVerification: false, count: 0 },
        steps: {
          welcome: {},
          verify: {},
          dashboard: {},
          blocked: {}
        },
        transitions: {
          welcome: {
            goToNextStep: [
              {
                id: "welcome-to-dashboard",
                to: "dashboard",
                updateContext: ({ context }) => ({ ...context, count: context.count + 10 })
              }
            ]
          }
        }
      })
    );

    const result = await machine.send({ type: "goToNextStep" });

    expect(result.transitionId).toBe("welcome-to-dashboard");
    expect(machine.getSnapshot().context.count).toBe(10);
  });

  it("supports completeJourney and terminateJourney event maps on steps", async () => {
    const completeMachine = startJourney(
      createJourneyMachine<Context, StepId, EventMap>({
        initial: "welcome",
        context: { needsVerification: false, count: 0 },
        steps: {
          welcome: {},
          verify: {},
          dashboard: {},
          blocked: {}
        },
        transitions: {
          welcome: {
            completeJourney: [{ updateContext: ({ context }) => ({ ...context, count: 42 }) }]
          }
        }
      })
    );

    await completeMachine.send({ type: "completeJourney" });
    expect(completeMachine.getSnapshot().status).toBe("completed");
    expect(completeMachine.getSnapshot().context.count).toBe(42);

    const terminateJourney = startJourney(
      createJourneyMachine<Context, StepId, EventMap>({
        initial: "welcome",
        context: { needsVerification: false, count: 0 },
        steps: {
          welcome: {},
          verify: {},
          dashboard: {},
          blocked: {}
        },
        transitions: {
          welcome: {
            terminateJourney: [{ updateContext: ({ context }) => ({ ...context, count: 99 }) }]
          }
        }
      })
    );

    await terminateJourney.send({ type: "terminateJourney" });
    expect(terminateJourney.getSnapshot().status).toBe("terminated");
    expect(terminateJourney.getSnapshot().context.count).toBe(99);
  });

  it("goToStepById navigates when a matching transition is declared", async () => {
    const machine = startJourney(
      createJourneyMachine<Context, StepId, EventMap>({
        initial: "welcome",
        context: { needsVerification: false, count: 0 },
        steps: {
          welcome: {},
          verify: {},
          dashboard: {},
          blocked: {}
        },
        transitions: {
          welcome: {
            goToNextStep: [{ to: "dashboard" }],
            goToStepById: [{ to: "verify" }]
          }
        }
      })
    );

    const result = await machine.send({ type: "goToStepById", stepId: "verify" });
    expect(result.transitioned).toBe(true);
    expect(machine.getSnapshot().currentStepId).toBe("verify");
  });
});
