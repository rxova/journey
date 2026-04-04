import { describe, expect, it } from "vitest";

import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "confirm";

type Context = { count: number };

const baseJourney = (): JourneyDefinition<Context, StepId> => ({
  initial: "start",
  context: { count: 0 },
  steps: {
    start: {},
    confirm: {}
  },
  transitions: {}
});

describe("terminal transitions", () => {
  it("applies effect context and marks complete", async () => {
    const journey = baseJourney();
    journey.transitions = {
      start: {
        completeJourney: [
          {
            id: "complete",
            updateContext: ({ context }) => ({ ...context, count: 7 })
          }
        ]
      }
    };

    const machine = createJourneyMachine(journey);
    machine.startJourney();

    await machine.send({ type: "completeJourney" });

    expect(machine.getSnapshot().status).toBe("completed");
    expect(machine.getSnapshot().context.count).toBe(7);
  });

  it("applies effect context and marks terminated", async () => {
    const journey = baseJourney();
    journey.transitions = {
      start: {
        terminateJourney: [
          {
            id: "terminateJourney",
            updateContext: ({ context }) => ({ ...context, count: 2 })
          }
        ]
      }
    };

    const machine = createJourneyMachine(journey);
    machine.startJourney();

    await machine.send({ type: "terminateJourney" });

    expect(machine.getSnapshot().status).toBe("terminated");
    expect(machine.getSnapshot().context.count).toBe(2);
  });

  it("supports root wildcard terminate transitions", async () => {
    const journey = baseJourney();
    journey.transitions = {
      global: {
        terminateJourney: [
          {
            updateContext: ({ context }) => ({ ...context, count: 9 })
          }
        ]
      }
    };

    const machine = createJourneyMachine(journey);
    machine.startJourney();

    await machine.send({ type: "terminateJourney" });

    expect(machine.getSnapshot().status).toBe("terminated");
    expect(machine.getSnapshot().context.count).toBe(9);
  });

  it("completeJourney resolves without an explicit transition", async () => {
    const journey = baseJourney();
    journey.transitions = {};

    const machine = createJourneyMachine(journey);
    machine.startJourney();

    const result = await machine.completeJourney();

    expect(result.transitioned).toBe(true);
    expect(machine.getSnapshot().status).toBe("completed");
  });

  it("terminateJourney resolves without an explicit transition", async () => {
    const journey = baseJourney();
    journey.transitions = {};

    const machine = createJourneyMachine(journey);
    machine.startJourney();

    const result = await machine.terminateJourney();

    expect(result.transitioned).toBe(true);
    expect(machine.getSnapshot().status).toBe("terminated");
  });

  it("completeJourney prefers an explicit transition with effect over fallback", async () => {
    const journey = baseJourney();
    journey.transitions = {
      start: {
        completeJourney: [
          {
            updateContext: ({ context }) => ({ ...context, count: 42 })
          }
        ]
      }
    };

    const machine = createJourneyMachine(journey);
    machine.startJourney();

    await machine.completeJourney();

    expect(machine.getSnapshot().status).toBe("completed");
    expect(machine.getSnapshot().context.count).toBe(42);
  });

  it("terminateJourney prefers an explicit transition with effect over fallback", async () => {
    const journey = baseJourney();
    journey.transitions = {
      start: {
        terminateJourney: [
          {
            updateContext: ({ context }) => ({ ...context, count: 99 })
          }
        ]
      }
    };

    const machine = createJourneyMachine(journey);
    machine.startJourney();

    await machine.terminateJourney();

    expect(machine.getSnapshot().status).toBe("terminated");
    expect(machine.getSnapshot().context.count).toBe(99);
  });

  it("completeJourney fallback emits journey.completed event", async () => {
    const journey = baseJourney();
    journey.transitions = {};

    const machine = createJourneyMachine(journey);
    machine.startJourney();

    const events: string[] = [];
    machine.subscribeEvent((event) => events.push(event.type));

    await machine.completeJourney();

    expect(events).toContain("transition.success");
    expect(events).toContain("journey.completed");
  });

  it("terminateJourney fallback emits journey.terminated event", async () => {
    const journey = baseJourney();
    journey.transitions = {};

    const machine = createJourneyMachine(journey);
    machine.startJourney();

    const events: string[] = [];
    machine.subscribeEvent((event) => events.push(event.type));

    await machine.terminateJourney();

    expect(events).toContain("transition.success");
    expect(events).toContain("journey.terminated");
  });

  it("completeJourney guarded transition can block, then fallback does not apply", async () => {
    const journey = baseJourney();
    journey.transitions = {
      start: {
        completeJourney: [
          {
            when: () => false
          }
        ]
      }
    };

    const machine = createJourneyMachine(journey);
    machine.startJourney();

    const result = await machine.completeJourney();

    // Explicit transition was declared but guard rejected — no fallback
    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().status).toBe("running");
  });

  it("supports goToNextStep terminal targets", async () => {
    const journey = baseJourney();
    journey.transitions = {
      start: {
        goToNextStep: [
          {
            to: "TERMINATED",
            updateContext: ({ context }) => ({ ...context, count: 3 })
          }
        ]
      }
    };

    const machine = createJourneyMachine(journey);
    machine.startJourney();

    await machine.send({ type: "goToNextStep" });

    expect(machine.getSnapshot().status).toBe("terminated");
    expect(machine.getSnapshot().context.count).toBe(3);
  });
});
