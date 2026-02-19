import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "details" | "review" | "confirmExit";
type Event = "goToNextStep" | "requestClose" | "terminateJourney" | "completeJourney" | "back";
type Context = { dirty: boolean; count: number };

const createJourney = (): JourneyDefinition<Context, StepId, Event> => ({
  initial: "start",
  context: { dirty: false, count: 0 },
  steps: {
    start: {},
    details: {},
    review: {},
    confirmExit: {}
  },
  transitions: [
    { from: "start", event: "goToNextStep", to: "details" },
    { from: "details", event: "goToNextStep", to: "review" },
    { from: "review", event: "completeJourney" },
    {
      from: "*",
      event: "requestClose",
      to: "confirmExit",
      when: ({ context }) => context.dirty
    }
  ]
});

type Action =
  | { type: "send"; event: Event }
  | { type: "goToStepById"; stepId: StepId }
  | { type: "goToPreviousStep"; steps: number }
  | { type: "goToLastVisitedStep" }
  | { type: "updateContext"; add: number; toggleDirty: boolean }
  | { type: "resetMachine" };

const actionArb: fc.Arbitrary<Action> = fc.oneof(
  fc
    .constantFrom<Event>(
      "goToNextStep",
      "requestClose",
      "terminateJourney",
      "completeJourney",
      "back"
    )
    .map((event) => ({ type: "send", event }) as const),
  fc
    .constantFrom<StepId>("start", "details", "review", "confirmExit")
    .map((stepId) => ({ type: "goToStepById", stepId }) as const),
  fc.integer({ min: 1, max: 6 }).map((steps) => ({ type: "goToPreviousStep", steps }) as const),
  fc.constant({ type: "goToLastVisitedStep" } as const),
  fc
    .record({ add: fc.integer({ min: 0, max: 3 }), toggleDirty: fc.boolean() })
    .map(({ add, toggleDirty }) => ({ type: "updateContext", add, toggleDirty }) as const),
  fc.constant({ type: "resetMachine" } as const)
);

describe("determinism fuzz", () => {
  it("produces identical snapshots for the same action sequence", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(actionArb, { minLength: 1, maxLength: 30 }), async (actions) => {
        const machineA = createJourneyMachine(createJourney());
        const machineB = createJourneyMachine(createJourney());

        for (const action of actions) {
          switch (action.type) {
            case "send":
              await machineA.send({ type: action.event });
              await machineB.send({ type: action.event });
              break;
            case "goToStepById":
              await machineA.send({ type: "goToStepById", stepId: action.stepId });
              await machineB.send({ type: "goToStepById", stepId: action.stepId });
              break;
            case "goToPreviousStep":
              await machineA.goToPreviousStep(action.steps);
              await machineB.goToPreviousStep(action.steps);
              break;
            case "goToLastVisitedStep":
              await machineA.goToLastVisitedStep();
              await machineB.goToLastVisitedStep();
              break;
            case "updateContext": {
              const updater = (context: Context) => ({
                count: context.count + action.add,
                dirty: action.toggleDirty ? !context.dirty : context.dirty
              });
              machineA.updateContext(updater);
              machineB.updateContext(updater);
              break;
            }
            case "resetMachine":
              machineA.resetMachine();
              machineB.resetMachine();
              break;
          }

          expect(machineA.getSnapshot()).toEqual(machineB.getSnapshot());
        }
      }),
      { numRuns: 30 }
    );
  });
});
