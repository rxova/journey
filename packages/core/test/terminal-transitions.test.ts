import { describe, expect, it } from "vitest";

import {
  createJourneyMachine,
  createTransitions,
  JOURNEY_STATUS,
  tx,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = "start" | "confirm";

type Context = { count: number };

const baseJourney = <TEvent extends string>(): JourneyDefinition<Context, StepId, TEvent> => ({
  initial: "start",
  context: { count: 0 },
  steps: {
    start: {},
    confirm: {}
  },
  transitions: []
});

describe("terminal transitions", () => {
  it("applies effect context and marks complete", async () => {
    const journey = baseJourney<"completeJourney">();
    journey.transitions = [
      {
        id: "complete",
        from: "start",
        event: "completeJourney",
        effect: ({ context }) => ({ ...context, count: 7 })
      }
    ];

    const machine = createJourneyMachine(journey);

    await machine.send({ type: "completeJourney" });

    expect(machine.getSnapshot().status).toBe(JOURNEY_STATUS.COMPLETE);
    expect(machine.getSnapshot().context.count).toBe(7);
  });

  it("applies effect context and marks terminated", async () => {
    const journey = baseJourney<"terminateJourney">();
    journey.transitions = [
      {
        id: "terminateJourney",
        from: "start",
        event: "terminateJourney",
        effect: ({ context }) => ({ ...context, count: 2 })
      }
    ];

    const machine = createJourneyMachine(journey);

    await machine.send({ type: "terminateJourney" });

    expect(machine.getSnapshot().status).toBe(JOURNEY_STATUS.TERMINATED);
    expect(machine.getSnapshot().context.count).toBe(2);
  });

  it("supports tx.from(...).toComplete()", async () => {
    const journey = baseJourney<"completeJourney">();
    journey.transitions = createTransitions(
      tx.from<StepId, Context>("start").toComplete({
        effect: ({ context }) => ({ ...context, count: 5 })
      })
    );

    const machine = createJourneyMachine(journey);

    await machine.send({ type: "completeJourney" });

    expect(machine.getSnapshot().status).toBe(JOURNEY_STATUS.COMPLETE);
    expect(machine.getSnapshot().context.count).toBe(5);
  });

  it("supports tx.any().toTerminate()", async () => {
    const journey = baseJourney<"terminateJourney">();
    journey.transitions = createTransitions(
      tx.any<Context, StepId>().toTerminate({
        effect: ({ context }) => ({ ...context, count: 9 })
      })
    );

    const machine = createJourneyMachine(journey);

    await machine.send({ type: "terminateJourney" });

    expect(machine.getSnapshot().status).toBe(JOURNEY_STATUS.TERMINATED);
    expect(machine.getSnapshot().context.count).toBe(9);
  });
});
