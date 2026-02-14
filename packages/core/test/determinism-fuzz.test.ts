import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  createJourneyMachine,
  HISTORY_TARGET,
  JOURNEY_STATUS,
  JOURNEY_TERMINAL,
  type JourneyDefinition,
  type JourneyEvent
} from "@rxova/journey-core";

type StepId = string;
type Event = "next" | "skip" | "jump" | "back";
type Context = { count: number };

type JourneyCase = {
  journey: JourneyDefinition<Context, StepId, Event>;
  steps: StepId[];
};

const buildJourneyArb = (): fc.Arbitrary<JourneyCase> =>
  fc.integer({ min: 2, max: 6 }).chain((stepCount) => {
    const steps = Array.from({ length: stepCount }, (_, index) => `s${index}`);
    const stepArb = fc.constantFrom(...steps);
    const eventArb = fc.constantFrom<Event>("next", "skip", "jump");
    const targetArb = fc.oneof(
      stepArb,
      fc.constant(HISTORY_TARGET),
      fc.constant(JOURNEY_TERMINAL.COMPLETE),
      fc.constant(JOURNEY_TERMINAL.CLOSE)
    );

    const transitionArb = fc.record({
      from: stepArb,
      event: eventArb,
      to: targetArb
    });

    return fc
      .array(transitionArb, { minLength: 0, maxLength: stepCount * 3 })
      .map((transitions) => {
        const stepsRecord = Object.fromEntries(steps.map((step) => [step, {}]));
        const journey: JourneyDefinition<Context, StepId, Event> = {
          initial: steps[0]!,
          context: { count: 0 },
          steps: stepsRecord,
          transitions: [
            {
              id: "back",
              from: "*",
              event: "back",
              to: HISTORY_TARGET
            },
            ...transitions.map((transition, index) => ({
              ...transition,
              id: `t${index}`
            }))
          ]
        };

        return { journey, steps };
      });
  });

const buildEventSequenceArb = (steps: StepId[]): fc.Arbitrary<JourneyEvent<StepId, Event>[]> =>
  fc.array(
    fc.oneof(
      fc
        .constantFrom<Event>("next", "skip", "jump", "back")
        .map((type): JourneyEvent<StepId, Event> => ({ type })),
      fc.constantFrom(...steps).map((to): JourneyEvent<StepId, Event> => ({ type: "goTo", to }))
    ),
    { minLength: 1, maxLength: 30 }
  );

const buildJourneyAndEventsArb = () =>
  buildJourneyArb().chain(({ journey, steps }) =>
    buildEventSequenceArb(steps).map((events) => ({ journey, steps, events }))
  );

describe("state machine fuzzing", () => {
  it("is deterministic across randomized transition graphs", async () => {
    await fc.assert(
      fc.asyncProperty(buildJourneyAndEventsArb(), async ({ journey, events }) => {
        const machineA = createJourneyMachine(journey);
        const machineB = createJourneyMachine(journey);

        for (const event of events) {
          const before = machineA.getSnapshot();
          const [resultA, resultB] = await Promise.all([
            machineA.send(event),
            machineB.send(event)
          ]);

          expect(resultA.snapshot).toEqual(resultB.snapshot);

          if (event.type === "back") {
            if (before.status !== JOURNEY_STATUS.RUNNING) {
              expect(resultA.snapshot).toEqual(before);
            } else if (before.history.length === 0) {
              expect(resultA.snapshot.current).toBe(before.current);
              expect(resultA.snapshot.history).toEqual(before.history);
            } else {
              expect(resultA.snapshot.current).toBe(before.history[before.history.length - 1]);
              expect(resultA.snapshot.history).toEqual(before.history.slice(0, -1));
            }
          }
        }
      }),
      { numRuns: 50 }
    );
  });
});
