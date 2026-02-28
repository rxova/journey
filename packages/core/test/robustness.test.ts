import { describe, expect, it } from "vitest";

import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "s0" | "s1" | "s2";
type Event = "goToNextStep" | "back" | "completeJourney";
type Context = { value: number };

const baseJourney = (): JourneyDefinition<Context, StepId, Event> => ({
  initial: "s0",
  context: { value: 0 },
  steps: {
    s0: {},
    s1: {},
    s2: {}
  },
  transitions: [
    { from: "s0", event: "goToNextStep", to: "s1" },
    { from: "s1", event: "goToNextStep", to: "s2" },
    { from: "s2", event: "completeJourney" }
  ]
});

describe("robustness", () => {
  it("throws when steps are not a record object", () => {
    const journey = baseJourney();
    expect(() =>
      createJourneyMachine({
        ...journey,
        steps: null as unknown as JourneyDefinition<Context, StepId, Event>["steps"]
      })
    ).toThrow(/steps must be a record object/i);
  });

  it("throws when transitions are not an array", () => {
    const journey = baseJourney();
    expect(() =>
      createJourneyMachine({
        ...journey,
        transitions: null as unknown as JourneyDefinition<Context, StepId, Event>["transitions"]
      })
    ).toThrow(/transitions must be an array/i);
  });

  it("throws when a transition entry is not an object", () => {
    const journey = baseJourney();
    journey.transitions = [null as unknown as (typeof journey.transitions)[number]];

    expect(() => createJourneyMachine(journey)).toThrow(/transition at index 0 must be an object/i);
  });

  it("throws when a transition is missing string from/event", () => {
    const journey = baseJourney();
    journey.transitions = [
      {
        from: "s0",
        event: 7 as unknown as Event,
        to: "s1"
      } as unknown as JourneyDefinition<Context, StepId, Event>["transitions"][number]
    ];

    expect(() => createJourneyMachine(journey)).toThrow(/must define string "from" and "event"/i);
  });

  it("throws on unknown transition from step", () => {
    const journey = baseJourney();
    journey.transitions = [{ from: "missing" as StepId, event: "goToNextStep", to: "s1" }];

    expect(() => createJourneyMachine(journey)).toThrow(/unknown from step/i);
  });

  it("throws on unknown initial step", () => {
    const journey = baseJourney();

    expect(() =>
      createJourneyMachine({
        ...journey,
        initial: "missing" as StepId
      })
    ).toThrow(/initial step/i);
  });

  it("throws on unknown transition target", () => {
    const journey = baseJourney();
    journey.transitions = [{ from: "s0", event: "goToNextStep", to: "missing" as StepId }];

    expect(() => createJourneyMachine(journey)).toThrow(/unknown step/i);
  });

  it('throws when "completeJourney" transition defines "to"', () => {
    const journey = baseJourney();
    journey.transitions = [
      {
        from: "s2",
        event: "completeJourney",
        to: "s2"
      } as unknown as JourneyDefinition<Context, StepId, Event>["transitions"][number]
    ];

    expect(() => createJourneyMachine(journey)).toThrow(/completeJourney.*cannot define "to"/i);
  });

  it("no-ops previous navigation at index zero", async () => {
    const machine = createJourneyMachine(baseJourney());

    const result = await machine.goToPreviousStep(2);

    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().currentStepId).toBe("s0");
    expect(machine.getSnapshot().history.index).toBe(0);
  });

  it("blocks default back fallback after terminal status", async () => {
    const machine = createJourneyMachine(baseJourney());

    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "completeJourney" });

    const result = await machine.send({ type: "back" });

    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().currentStepId).toBe("s2");
  });
});
