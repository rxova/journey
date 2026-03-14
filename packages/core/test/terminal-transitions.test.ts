import { describe, expect, it } from "vitest";

import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

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

    expect(machine.getSnapshot().status).toBe("complete");
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

    expect(machine.getSnapshot().status).toBe("terminated");
    expect(machine.getSnapshot().context.count).toBe(2);
  });

  it("supports tx.from(...).toComplete()", async () => {
    const journey = baseJourney<"completeJourney">();
    journey.transitions = ({ createTransitions, tx }) =>
      createTransitions(
        tx.from("start").toComplete({
          effect: ({ context }) => ({ ...context, count: 5 })
        })
      );

    const machine = createJourneyMachine(journey);

    await machine.send({ type: "completeJourney" });

    expect(machine.getSnapshot().status).toBe("complete");
    expect(machine.getSnapshot().context.count).toBe(5);
  });

  it("supports tx.any().toTerminate()", async () => {
    const journey = baseJourney<"terminateJourney">();
    journey.transitions = ({ createTransitions, tx }) =>
      createTransitions(
        tx.any().toTerminate({
          effect: ({ context }) => ({ ...context, count: 9 })
        })
      );

    const machine = createJourneyMachine(journey);

    await machine.send({ type: "terminateJourney" });

    expect(machine.getSnapshot().status).toBe("terminated");
    expect(machine.getSnapshot().context.count).toBe(9);
  });

  it("supports tx.from(...).toTerminate()", async () => {
    const journey = baseJourney<"terminateJourney">();
    journey.transitions = ({ createTransitions, tx }) =>
      createTransitions(
        tx.from("start").toTerminate({
          effect: ({ context }) => ({ ...context, count: 3 })
        })
      );

    const machine = createJourneyMachine(journey);

    await machine.send({ type: "terminateJourney" });

    expect(machine.getSnapshot().status).toBe("terminated");
    expect(machine.getSnapshot().context.count).toBe(3);
  });

  it("supports tx.any().toComplete()", async () => {
    const journey = baseJourney<"completeJourney">();
    journey.transitions = ({ createTransitions, tx }) =>
      createTransitions(
        tx.any().toComplete({
          effect: ({ context }) => ({ ...context, count: 4 })
        })
      );

    const machine = createJourneyMachine(journey);

    await machine.send({ type: "completeJourney" });

    expect(machine.getSnapshot().status).toBe("complete");
    expect(machine.getSnapshot().context.count).toBe(4);
  });

  it("supports tx.from(...).on('terminateJourney').terminate()", async () => {
    const journey = baseJourney<"terminateJourney">();
    journey.transitions = ({ createTransitions, tx }) =>
      createTransitions(
        tx
          .from("start")
          .on("terminateJourney")
          .terminate({
            effect: ({ context }) => ({ ...context, count: 6 })
          })
      );

    const machine = createJourneyMachine(journey);

    await machine.send({ type: "terminateJourney" });

    expect(machine.getSnapshot().status).toBe("terminated");
    expect(machine.getSnapshot().context.count).toBe(6);
  });
});
