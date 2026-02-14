import { describe, expect, it, vi } from "vitest";

import {
  createJourneyMachine,
  type JourneyDefinition,
  type JourneyHistoryOverflow
} from "@rxova/journey-core";

type StepId = "a" | "b" | "c" | "d";
type Context = { value: number };
type Event = "next";

const createJourney = (): JourneyDefinition<Context, StepId, Event> => ({
  initial: "a",
  context: { value: 0 },
  steps: {
    a: {},
    b: {},
    c: {},
    d: {}
  },
  transitions: []
});

describe("history limits", () => {
  it("trims history to maxHistory on transitions", async () => {
    const machine = createJourneyMachine(createJourney(), {
      history: { maxHistory: 2 }
    });

    await machine.send({ type: "goTo", to: "b" });
    await machine.send({ type: "goTo", to: "c" });
    await machine.send({ type: "goTo", to: "d" });

    expect(machine.getSnapshot().history).toEqual(["b", "c"]);
    expect(machine.getSnapshot().visited).toEqual(["a", "b", "c", "d"]);
  });

  it("fires onOverflow when history is trimmed automatically", async () => {
    const overflows: Array<JourneyHistoryOverflow<StepId>> = [];
    const onOverflow = vi.fn((info: JourneyHistoryOverflow<StepId>) => {
      overflows.push(info);
    });

    const machine = createJourneyMachine(createJourney(), {
      history: { maxHistory: 1, onOverflow }
    });

    await machine.send({ type: "goTo", to: "b" });
    await machine.send({ type: "goTo", to: "c" });

    expect(machine.getSnapshot().history).toEqual(["b"]);
    expect(onOverflow).toHaveBeenCalledTimes(1);
    expect(overflows[0]).toMatchObject({
      previous: ["a", "b"],
      next: ["b"],
      trimmed: ["a"],
      maxHistory: 1,
      reason: "auto"
    });
  });

  it("supports manual trimHistory and clearHistory", async () => {
    const machine = createJourneyMachine(createJourney(), {
      history: { maxHistory: 3 }
    });

    await machine.send({ type: "goTo", to: "b" });
    await machine.send({ type: "goTo", to: "c" });
    await machine.send({ type: "goTo", to: "d" });

    machine.trimHistory(1);
    expect(machine.getSnapshot().history).toEqual(["c"]);

    machine.clearHistory();
    expect(machine.getSnapshot().history).toEqual([]);
  });

  it("allows disabling maxHistory with null", async () => {
    const machine = createJourneyMachine(createJourney(), {
      history: { maxHistory: null }
    });

    await machine.send({ type: "goTo", to: "b" });
    await machine.send({ type: "goTo", to: "c" });
    await machine.send({ type: "goTo", to: "d" });

    expect(machine.getSnapshot().history).toEqual(["a", "b", "c"]);
  });
});
