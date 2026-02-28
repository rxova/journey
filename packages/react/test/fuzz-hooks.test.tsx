import { describe, expect, it } from "vitest";
import fc from "fast-check";

import React from "react";
import { act } from "react";
import { render } from "@testing-library/react";

import {
  createJourneyMachine,
  type JourneyDefinition,
  type JourneyEvent,
  type JourneySnapshot
} from "@rxova/journey-core";
import {
  createJourneyBindings,
  type JourneyApi,
  type JourneyReactDefinition
} from "@rxova/journey-react";

type StepId = "start" | "details" | "review" | "confirmExit";
type Event =
  | "goToNextStep"
  | "goToPreviousStep"
  | "requestClose"
  | "terminateJourney"
  | "completeJourney";
type Ctx = { dirty: boolean; count: number };

const transitions: JourneyDefinition<Ctx, StepId, Event>["transitions"] = [
  { from: "start", event: "goToNextStep", to: "details" },
  { from: "details", event: "goToNextStep", to: "review" },
  { from: "review", event: "goToNextStep", to: "review" },
  {
    from: "*",
    event: "requestClose",
    to: "confirmExit",
    when: ({ context }) => context.dirty
  },
  {
    from: "*",
    event: "terminateJourney",
    when: ({ context }) => !context.dirty
  },
  { from: "review", event: "completeJourney" }
];

const reactJourney: JourneyReactDefinition<Ctx, StepId, Event> = {
  initial: "start",
  context: { dirty: false, count: 0 },
  steps: {
    start: { component: () => <div /> },
    details: { component: () => <div /> },
    review: { component: () => <div /> },
    confirmExit: { component: () => <div /> }
  },
  transitions
};

const coreJourney: JourneyDefinition<Ctx, StepId, Event> = {
  initial: reactJourney.initial,
  context: reactJourney.context,
  steps: {
    start: {},
    details: {},
    review: {},
    confirmExit: {}
  },
  transitions
};

const bindings = createJourneyBindings(reactJourney);

let latestSnapshot: JourneySnapshot<Ctx, StepId> | null = null;
let latestApi: JourneyApi<Ctx, StepId, Event> | null = null;

const Harness = () => {
  const snapshot = bindings.useJourneySnapshot();
  const api = bindings.useJourneyApi();

  React.useLayoutEffect(() => {
    latestSnapshot = snapshot;
    latestApi = api;
  }, [snapshot, api]);

  return null;
};

type Action =
  | { type: Event }
  | { type: "goToStepById"; stepId: StepId; withPayload: boolean }
  | { type: "goToPreviousStepByCount"; steps: number }
  | { type: "goToLastVisitedStep" }
  | { type: "updateContext"; delta: number; toggleDirty: boolean }
  | { type: "resetJourney" };

const actionArb: fc.Arbitrary<Action> = fc.oneof(
  fc
    .constantFrom<Event>("goToNextStep", "goToPreviousStep", "terminateJourney", "completeJourney")
    .map((type) => ({ type }) as const),
  fc
    .record({
      stepId: fc.constantFrom<StepId>("start", "details", "review", "confirmExit"),
      withPayload: fc.boolean()
    })
    .map(({ stepId, withPayload }) => ({ type: "goToStepById", stepId, withPayload }) as const),
  fc
    .integer({ min: 1, max: 4 })
    .map((steps) => ({ type: "goToPreviousStepByCount", steps }) as const),
  fc.constant({ type: "goToLastVisitedStep" } as const),
  fc
    .record({
      delta: fc.integer({ min: 0, max: 2 }),
      toggleDirty: fc.boolean()
    })
    .map(({ delta, toggleDirty }) => ({ type: "updateContext", delta, toggleDirty }) as const),
  fc.constant({ type: "resetJourney" } as const)
);

describe("react journey fuzzing", () => {
  it("keeps bindings snapshots aligned with core machine", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(actionArb, { minLength: 1, maxLength: 25 }), async (actions) => {
        latestSnapshot = null;
        latestApi = null;

        const { unmount } = render(
          <bindings.Provider>
            <Harness />
          </bindings.Provider>
        );

        const coreMachine = createJourneyMachine(coreJourney);
        expect(latestSnapshot).toEqual(coreMachine.getSnapshot());

        for (const action of actions) {
          await act(async () => {
            switch (action.type) {
              case "goToNextStep":
              case "goToPreviousStep":
              case "terminateJourney":
              case "completeJourney": {
                const event = { type: action.type } as JourneyEvent<StepId, Event>;
                await coreMachine.send(event);
                await latestApi?.send(event);
                break;
              }
              case "goToStepById": {
                const event = action.withPayload
                  ? ({
                      type: "goToStepById",
                      stepId: action.stepId,
                      payload: { source: "fuzz" }
                    } as const)
                  : ({ type: "goToStepById", stepId: action.stepId } as const);
                await coreMachine.send(event);
                await latestApi?.send(event);
                break;
              }
              case "goToPreviousStepByCount":
                await coreMachine.goToPreviousStep(action.steps);
                await latestApi?.goToPreviousStep(action.steps);
                break;
              case "goToLastVisitedStep":
                await coreMachine.goToLastVisitedStep();
                await latestApi?.goToLastVisitedStep();
                break;
              case "updateContext": {
                const updater = (ctx: Ctx) => ({
                  ...ctx,
                  count: ctx.count + action.delta,
                  dirty: action.toggleDirty ? !ctx.dirty : ctx.dirty
                });
                coreMachine.updateContext(updater);
                latestApi?.updateContext(updater);
                break;
              }
              case "resetJourney":
                coreMachine.resetMachine();
                latestApi?.resetJourney();
                break;
            }
          });

          expect(latestSnapshot).toEqual(coreMachine.getSnapshot());
        }

        unmount();
      }),
      { numRuns: 25 }
    );
  });
});
