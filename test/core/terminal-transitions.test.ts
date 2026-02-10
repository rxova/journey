import { describe, expect, it } from "vitest";

import {
  createJourneyMachine,
  JOURNEY_STATUS,
  JOURNEY_TERMINAL,
  type JourneyDefinition
} from "@/src/core";

type StepId = "start" | "confirm";

type Context = { count: number };

type Event = "submit" | "close";

const baseJourney = (): JourneyDefinition<Context, StepId, Event> => ({
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
    const journey = baseJourney();
    journey.transitions = [
      {
        id: "complete",
        from: "start",
        event: "submit",
        to: JOURNEY_TERMINAL.COMPLETE,
        effect: ({ context }) => ({ ...context, count: 7 })
      }
    ];

    const machine = createJourneyMachine(journey);

    await machine.send({ type: "submit" });

    expect(machine.getSnapshot().status).toBe(JOURNEY_STATUS.COMPLETE);
    expect(machine.getSnapshot().context.count).toBe(7);
  });

  it("applies effect context and marks closed", async () => {
    const journey = baseJourney();
    journey.transitions = [
      {
        id: "close",
        from: "start",
        event: "close",
        to: JOURNEY_TERMINAL.CLOSE,
        effect: ({ context }) => ({ ...context, count: 2 })
      }
    ];

    const machine = createJourneyMachine(journey);

    await machine.send({ type: "close" });

    expect(machine.getSnapshot().status).toBe(JOURNEY_STATUS.CLOSED);
    expect(machine.getSnapshot().context.count).toBe(2);
  });
});
