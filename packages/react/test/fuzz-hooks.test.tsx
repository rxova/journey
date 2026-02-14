import { describe, expect, it } from "vitest";
import fc from "fast-check";

import React from "react";
import { render } from "@testing-library/react";
import { act } from "react";

import {
  createJourneyMachine,
  HISTORY_TARGET,
  JOURNEY_TERMINAL,
  type JourneyDefinition,
  type JourneyEvent,
  type JourneySnapshot
} from "@rxova/journey-core";
import { JourneyProvider, useJourney, type JourneyReactDefinition } from "@rxova/journey-react";
import type { JourneyApi } from "@rxova/journey-react";

type StepId = "start" | "details" | "review" | "confirmExit";
type Event = "next" | "back" | "close" | "submit";
type Ctx = { dirty: boolean; count: number };

const Step = () => <div />;

const transitions: JourneyDefinition<Ctx, StepId, Event>["transitions"] = [
  { from: "start", event: "next", to: "details" },
  { from: "details", event: "next", to: "review" },
  { from: "review", event: "next", to: "review" },
  { from: "*", event: "back", to: HISTORY_TARGET },
  {
    from: "*",
    event: "close",
    to: "confirmExit",
    when: ({ context }: { context: Ctx }) => context.dirty
  },
  {
    from: "*",
    event: "close",
    to: JOURNEY_TERMINAL.CLOSE,
    when: ({ context }: { context: Ctx }) => !context.dirty
  },
  { from: "review", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
];

const reactJourney: JourneyReactDefinition<Ctx, StepId, Event> = {
  initial: "start",
  context: { dirty: false, count: 0 },
  steps: {
    start: { component: Step },
    details: { component: Step },
    review: { component: Step },
    confirmExit: { component: Step }
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

const steps: StepId[] = ["start", "details", "review", "confirmExit"];

let latestSnapshot: JourneySnapshot<Ctx, StepId> | null = null;
let latestApi: JourneyApi<Ctx, StepId, Event> | null = null;

const Harness = () => {
  const { snapshot, api } = useJourney<Ctx, StepId, Event>();

  React.useLayoutEffect(() => {
    latestSnapshot = snapshot;
    latestApi = api;
  }, [snapshot, api]);

  return null;
};

type Action =
  | { type: Event }
  | { type: "goTo"; to: StepId }
  | { type: "updateContext"; delta: number; toggleDirty: boolean }
  | { type: "reset" };

const actionArb: fc.Arbitrary<Action> = fc.oneof(
  fc.constantFrom<Event>("next", "back", "close", "submit").map((type) => ({ type }) as const),
  fc.constantFrom(...steps).map((to) => ({ type: "goTo", to }) as const),
  fc
    .record({
      delta: fc.integer({ min: 0, max: 2 }),
      toggleDirty: fc.boolean()
    })
    .map(({ delta, toggleDirty }) => ({ type: "updateContext", delta, toggleDirty }) as const),
  fc.constant({ type: "reset" } as const)
);

const actionSequenceArb: fc.Arbitrary<Action[]> = fc.array(actionArb, {
  minLength: 1,
  maxLength: 25
});

describe("react journey fuzzing", () => {
  it("keeps hook snapshots aligned with core machine", async () => {
    await fc.assert(
      fc.asyncProperty(actionSequenceArb, async (actions) => {
        latestSnapshot = null;
        latestApi = null;

        const { unmount } = render(
          <JourneyProvider journey={reactJourney}>
            <Harness />
          </JourneyProvider>
        );

        const coreMachine = createJourneyMachine(coreJourney);
        expect(latestSnapshot).not.toBeNull();
        expect(latestSnapshot).toEqual(coreMachine.getSnapshot());

        for (const action of actions) {
          await act(async () => {
            if (!latestApi) {
              return;
            }

            switch (action.type) {
              case "next":
              case "back":
              case "close":
              case "submit": {
                const event = { type: action.type } as JourneyEvent<StepId, Event>;
                await coreMachine.send(event);
                await latestApi.send(event);
                break;
              }
              case "goTo": {
                await coreMachine.send({ type: "goTo", to: action.to });
                await latestApi.goTo(action.to);
                break;
              }
              case "updateContext": {
                const updater = (ctx: Ctx) => ({
                  ...ctx,
                  count: ctx.count + action.delta,
                  dirty: action.toggleDirty ? !ctx.dirty : ctx.dirty
                });
                coreMachine.updateContext(updater);
                latestApi.updateContext(updater);
                break;
              }
              case "reset": {
                coreMachine.reset();
                latestApi.reset();
                break;
              }
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
