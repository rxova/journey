import { describe, expect, it } from "vitest";

import { createJourneyMachine, HISTORY_TARGET, type JourneyDefinition } from "@/src/core";

type StepId = "s0" | "s1" | "s2";
type Event = "next" | "back";
type Ctx = { value: number };

const createSmallJourney = (): JourneyDefinition<Ctx, StepId, Event> => ({
  initial: "s0",
  context: { value: 0 },
  steps: {
    s0: {},
    s1: {},
    s2: {}
  },
  transitions: [
    { from: "s0", event: "next", to: "s1" },
    { from: "s1", event: "next", to: "s2" },
    { from: "*", event: "back", to: HISTORY_TARGET }
  ]
});

describe("core robustness", () => {
  it("fails fast for malformed steps config", () => {
    expect(() =>
      createJourneyMachine({
        ...createSmallJourney(),
        steps: null as unknown as JourneyDefinition<Ctx, StepId, Event>["steps"]
      })
    ).toThrow("Journey steps must be a record object.");
  });

  it("fails fast for malformed transitions config", () => {
    expect(() =>
      createJourneyMachine({
        ...createSmallJourney(),
        transitions: undefined as unknown as JourneyDefinition<Ctx, StepId, Event>["transitions"]
      })
    ).toThrow("Journey transitions must be an array.");
  });

  it("fails fast when a transition references an unknown source step", () => {
    expect(() =>
      createJourneyMachine({
        ...createSmallJourney(),
        transitions: [{ from: "missing" as StepId, event: "next", to: "s1" }]
      })
    ).toThrow('Journey transition at index 0 references unknown from step "missing".');
  });

  it("fails fast when a transition points to an unknown target step", () => {
    expect(() =>
      createJourneyMachine({
        ...createSmallJourney(),
        transitions: [{ from: "s0", event: "next", to: "missing" as StepId }]
      })
    ).toThrow('Journey transition at index 0 points to unknown step "missing".');
  });

  it("fails fast when a transition entry is not an object", () => {
    expect(() =>
      createJourneyMachine({
        ...createSmallJourney(),
        transitions: [null] as unknown as JourneyDefinition<Ctx, StepId, Event>["transitions"]
      })
    ).toThrow("Journey transition at index 0 must be an object.");
  });

  it("fails fast when transition from/event are not strings", () => {
    expect(() =>
      createJourneyMachine({
        ...createSmallJourney(),
        transitions: [
          {
            from: 0 as unknown as StepId,
            event: {} as unknown as Event,
            to: "s1"
          }
        ]
      })
    ).toThrow('Journey transition at index 0 must define string "from" and "event".');
  });

  it("handles rapid event firing deterministically", async () => {
    const machine = createJourneyMachine(createSmallJourney());
    const results = await Promise.all(
      Array.from({ length: 100 }, () => machine.send({ type: "next" }))
    );

    expect(machine.getSnapshot().current).toBe("s2");
    expect(machine.getSnapshot().history).toEqual(["s0", "s1"]);
    expect(results.filter((result) => result.transitioned)).toHaveLength(2);
  });

  it("supports large step counts and deep history traversal", async () => {
    const stepCount = 150;
    const steps = Object.fromEntries(
      Array.from({ length: stepCount }, (_, i) => [`s${i}`, {}])
    ) as Record<string, unknown>;
    const transitions = [
      ...Array.from({ length: stepCount - 1 }, (_, i) => ({
        from: `s${i}`,
        event: "next",
        to: `s${i + 1}`
      })),
      { from: "*", event: "back", to: HISTORY_TARGET }
    ] as const;

    const machine = createJourneyMachine({
      initial: "s0",
      context: { value: 0 },
      steps,
      transitions
    });

    for (let i = 0; i < stepCount - 1; i += 1) {
      await machine.send({ type: "next" });
    }

    expect(machine.getSnapshot().current).toBe(`s${stepCount - 1}`);
    expect(machine.getSnapshot().history).toHaveLength(stepCount - 1);

    for (let i = 0; i < stepCount - 1; i += 1) {
      await machine.send({ type: "back" });
    }

    expect(machine.getSnapshot().current).toBe("s0");
  });
});
