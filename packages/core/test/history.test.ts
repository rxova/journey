import { describe, expect, it } from "vitest";

import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";
import type { JourneyTransitionGraph } from "../src/types";

type StepId = "a" | "b" | "c" | "d";
type EventMap = { type: "back"; payload?: unknown } | { type: "jump"; payload?: unknown };
type Context = { count: number };

const createJourney = (): JourneyDefinition<Context, StepId, EventMap> => ({
  initial: "a",
  context: { count: 0 },
  steps: {
    a: {},
    b: {},
    c: {},
    d: {}
  },
  transitions: {
    a: { goToNextStep: [{ label: "a-b", to: "b" }] },
    b: {
      goToNextStep: [{ label: "b-c", to: "c" }],
      jump: [{ label: "b-d", to: "d" }]
    },
    c: { goToNextStep: [{ label: "c-d", to: "d" }] }
  }
});

const createStartedMachine = () => {
  const machine = createJourneyMachine(createJourney());
  machine.startJourney();
  return machine;
};

describe("timeline navigation", () => {
  it("goToPreviousStep no-ops before the machine has started", async () => {
    const machine = createJourneyMachine(createJourney());
    const events: string[] = [];

    machine.subscribeEvent((event) => {
      events.push(event.type);
    });

    const result = await machine.goToPreviousStep(2);

    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().currentStepId).toBe("a");
    expect(machine.getSnapshot().history.index).toBe(0);
    expect(events).toEqual([]);
  });

  it("goToLastVisitedStep no-ops before the machine has started", async () => {
    const machine = createJourneyMachine(createJourney());
    const events: string[] = [];

    machine.subscribeEvent((event) => {
      events.push(event.type);
    });

    const result = await machine.goToLastVisitedStep();

    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().currentStepId).toBe("a");
    expect(machine.getSnapshot().history.index).toBe(0);
    expect(events).toEqual([]);
  });

  it("keeps current as timeline[index]", async () => {
    const machine = createStartedMachine();

    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });

    const snapshot = machine.getSnapshot();
    expect(snapshot.history.timeline).toEqual(["a", "b", "c"]);
    expect(snapshot.history.index).toBe(2);
    expect(snapshot.currentStepId).toBe(snapshot.history.timeline[snapshot.history.index]);
  });

  it("goToPreviousStep clamps and defaults to one step", async () => {
    const machine = createStartedMachine();

    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });

    await machine.goToPreviousStep();
    expect(machine.getSnapshot().currentStepId).toBe("c");

    await machine.goToPreviousStep(10);
    const snapshot = machine.getSnapshot();
    expect(snapshot.history.index).toBe(0);
    expect(snapshot.currentStepId).toBe("a");
  });

  it("goToLastVisitedStep jumps to timeline tail", async () => {
    const machine = createStartedMachine();

    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });
    await machine.goToPreviousStep(2);

    expect(machine.getSnapshot().currentStepId).toBe("b");

    await machine.goToLastVisitedStep();

    const snapshot = machine.getSnapshot();
    expect(snapshot.currentStepId).toBe("d");
    expect(snapshot.history.index).toBe(snapshot.history.timeline.length - 1);
  });

  it("goToLastVisitedStep no-ops when already at the timeline tail", async () => {
    const machine = createStartedMachine();

    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });

    const result = await machine.goToLastVisitedStep();

    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().currentStepId).toBe("d");
  });

  it("send(back) without an explicit transition no-ops", async () => {
    const machine = createStartedMachine();

    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });
    const result = await machine.send({ type: "back" });

    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().currentStepId).toBe("c");
  });

  it("send(goToPreviousStep) falls back to previous-step navigation", async () => {
    const machine = createStartedMachine();

    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });

    const result = await machine.send({ type: "goToPreviousStep" });

    expect(result.transitioned).toBe(true);
    expect(result.transitionId).toBe("goToPreviousStep");
    expect(machine.getSnapshot().currentStepId).toBe("b");
  });

  it("goToPreviousStep no-ops at index zero after the machine has started", async () => {
    const machine = createStartedMachine();

    const result = await machine.goToPreviousStep(2);

    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().currentStepId).toBe("a");
    expect(machine.getSnapshot().history.index).toBe(0);
  });

  it("navigation APIs no-op after completion", async () => {
    const machine = createStartedMachine();
    const events: string[] = [];

    machine.subscribeEvent((event) => {
      events.push(event.type);
    });

    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });
    await machine.completeJourney();

    const previous = await machine.goToPreviousStep();
    const lastVisited = await machine.goToLastVisitedStep();

    expect(previous.transitioned).toBe(false);
    expect(lastVisited.transitioned).toBe(false);
    expect(machine.getSnapshot().status).toBe("completed");
    expect(machine.getSnapshot().currentStepId).toBe("d");
    expect(events).not.toContain("navigation.previous");
    expect(events).not.toContain("navigation.lastVisited");
  });

  it("navigation APIs no-op after termination", async () => {
    const machine = createStartedMachine();
    const events: string[] = [];

    machine.subscribeEvent((event) => {
      events.push(event.type);
    });

    await machine.send({ type: "goToNextStep" });
    await machine.terminateJourney();

    const previous = await machine.goToPreviousStep();
    const lastVisited = await machine.goToLastVisitedStep();

    expect(previous.transitioned).toBe(false);
    expect(lastVisited.transitioned).toBe(false);
    expect(machine.getSnapshot().status).toBe("terminated");
    expect(machine.getSnapshot().currentStepId).toBe("b");
    expect(events).not.toContain("navigation.previous");
    expect(events).not.toContain("navigation.lastVisited");
  });

  it("explicit custom back transition still works when declared", async () => {
    const journey = createJourney();
    const transitions = journey.transitions as JourneyTransitionGraph<Context, StepId, EventMap>;
    journey.transitions = {
      ...transitions,
      c: {
        ...transitions.c,
        back: [{ label: "explicit-back", to: "d" }]
      }
    };

    const machine = createJourneyMachine(journey);
    machine.startJourney();

    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });
    const result = await machine.send({ type: "back" });

    expect(result.transitioned).toBe(true);
    expect(result.transitionId).toEqual(expect.any(String));
    expect(result.label).toBe("explicit-back");
    expect(machine.getSnapshot().currentStepId).toBe("d");
  });

  it("truncates tail when moving forward after going back", async () => {
    const machine = createStartedMachine();

    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });

    await machine.goToPreviousStep(2);
    await machine.send({ type: "jump" });

    const snapshot = machine.getSnapshot();
    expect(snapshot.currentStepId).toBe("d");
    expect(snapshot.history.timeline).toEqual(["a", "b", "d"]);
    expect(snapshot.history.index).toBe(2);
  });
});
