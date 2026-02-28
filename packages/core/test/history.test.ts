import { describe, expect, it } from "vitest";

import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "a" | "b" | "c" | "d";
type Event = "goToNextStep" | "back" | "jump";
type Context = { count: number };

const createJourney = (): JourneyDefinition<Context, StepId, Event> => ({
  initial: "a",
  context: { count: 0 },
  steps: {
    a: {},
    b: {},
    c: {},
    d: {}
  },
  transitions: [
    { id: "a-b", from: "a", event: "goToNextStep", to: "b" },
    { id: "b-c", from: "b", event: "goToNextStep", to: "c" },
    { id: "c-d", from: "c", event: "goToNextStep", to: "d" },
    { id: "b-d", from: "b", event: "jump", to: "d" }
  ]
});

describe("timeline navigation", () => {
  it("keeps current as timeline[index]", async () => {
    const machine = createJourneyMachine(createJourney());

    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });

    const snapshot = machine.getSnapshot();
    expect(snapshot.history.timeline).toEqual(["a", "b", "c"]);
    expect(snapshot.history.index).toBe(2);
    expect(snapshot.currentStepId).toBe(snapshot.history.timeline[snapshot.history.index]);
  });

  it("goToPreviousStep clamps and defaults to one step", async () => {
    const machine = createJourneyMachine(createJourney());

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
    const machine = createJourneyMachine(createJourney());

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

  it("send(back) falls back to previous-step navigation", async () => {
    const machine = createJourneyMachine(createJourney());

    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });
    const result = await machine.send({ type: "back" });

    expect(result.transitioned).toBe(true);
    expect(machine.getSnapshot().currentStepId).toBe("b");
  });

  it("explicit back transition wins over fallback", async () => {
    const journey = createJourney();
    journey.transitions = [
      ...journey.transitions,
      { id: "explicit-back", from: "c", event: "back", to: "d" }
    ];

    const machine = createJourneyMachine(journey);

    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });
    const result = await machine.send({ type: "back" });

    expect(result.transitioned).toBe(true);
    expect(result.transitionId).toBe("explicit-back");
    expect(machine.getSnapshot().currentStepId).toBe("d");
  });

  it("truncates tail when moving forward after going back", async () => {
    const machine = createJourneyMachine(createJourney());

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
