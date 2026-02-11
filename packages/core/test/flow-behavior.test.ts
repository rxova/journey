import { describe, expect, it } from "vitest";

import {
  createJourneyMachine,
  JOURNEY_STATUS,
  HISTORY_TARGET,
  JOURNEY_TERMINAL,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = "a" | "b" | "c" | "d" | "confirm";
type Event = "next" | "back" | "close" | "submit" | "skip";
type Context = {
  flag: boolean;
  dirty: boolean;
  count: number;
  log: string[];
};
const idleStepAsync = () => ({
  phase: "idle" as const,
  eventType: null,
  transitionId: null,
  error: null
});
const asyncState = () => ({
  isLoading: false,
  byStep: {
    a: idleStepAsync(),
    b: idleStepAsync(),
    c: idleStepAsync(),
    d: idleStepAsync(),
    confirm: idleStepAsync()
  }
});

const createJourney = (): JourneyDefinition<Context, StepId, Event> => ({
  initial: "a",
  context: {
    flag: false,
    dirty: false,
    count: 0,
    log: []
  },
  steps: {
    a: {},
    b: {},
    c: {},
    d: {},
    confirm: {}
  },
  transitions: [
    {
      id: "a-to-b-if-flag",
      from: "a",
      event: "next",
      to: "b",
      when: ({ context }) => context.flag
    },
    {
      id: "a-to-c-default",
      from: "a",
      event: "next",
      to: "c"
    },
    {
      id: "c-to-d",
      from: "c",
      event: "next",
      to: "d"
    },
    {
      id: "d-submit",
      from: "d",
      event: "submit",
      to: JOURNEY_TERMINAL.COMPLETE
    },
    {
      id: "global-back",
      from: "*",
      event: "back",
      to: HISTORY_TARGET
    },
    {
      id: "global-close-dirty",
      from: "*",
      event: "close",
      to: "confirm",
      when: ({ context }) => context.dirty
    },
    {
      id: "global-close-clean",
      from: "*",
      event: "close",
      to: JOURNEY_TERMINAL.CLOSE,
      when: ({ context }) => !context.dirty
    },
    {
      id: "skip-c",
      from: "c",
      event: "skip",
      to: "d"
    }
  ]
});

describe("journey behavior edge cases", () => {
  it("uses second transition when first guard is false", async () => {
    const machine = createJourneyMachine(createJourney());
    await machine.send({ type: "next" });
    expect(machine.getSnapshot().current).toBe("c");
  });

  it("uses first transition when first guard is true", async () => {
    const machine = createJourneyMachine(createJourney());
    machine.updateContext((ctx) => ({ ...ctx, flag: true }));
    await machine.send({ type: "next" });
    expect(machine.getSnapshot().current).toBe("b");
  });

  it("returns transition id on success", async () => {
    const machine = createJourneyMachine(createJourney());
    const result = await machine.send({ type: "next" });
    expect(result.transitioned).toBe(true);
    expect(result.transitionId).toBe("a-to-c-default");
  });

  it("does not set transition id on no-op", async () => {
    const machine = createJourneyMachine(createJourney());
    const result = await machine.send({ type: "submit" });
    expect(result.transitioned).toBe(false);
    expect(result.transitionId).toBeUndefined();
  });

  it("keeps context when effect returns undefined", async () => {
    const journey = createJourney();
    journey.transitions = [
      {
        from: "a",
        event: "next",
        to: "b",
        effect: () => undefined
      }
    ];
    const machine = createJourneyMachine(journey);
    const before = machine.getSnapshot().context;
    await machine.send({ type: "next" });
    expect(machine.getSnapshot().context).toEqual(before);
  });

  it("applies context from effect when provided", async () => {
    const journey = createJourney();
    journey.transitions = [
      {
        from: "a",
        event: "next",
        to: "b",
        effect: ({ context }) => ({ ...context, count: context.count + 3 })
      }
    ];
    const machine = createJourneyMachine(journey);
    await machine.send({ type: "next" });
    expect(machine.getSnapshot().context.count).toBe(3);
  });

  it("keeps current step when history target has no entries", async () => {
    const machine = createJourneyMachine(createJourney());
    await machine.send({ type: "back" });
    expect(machine.getSnapshot().current).toBe("a");
  });

  it("pops to previous step with history target", async () => {
    const machine = createJourneyMachine(createJourney());
    await machine.send({ type: "next" });
    await machine.send({ type: "next" });
    await machine.send({ type: "back" });
    expect(machine.getSnapshot().current).toBe("c");
    expect(machine.getSnapshot().history).toEqual(["a"]);
  });

  it("stores unique visited list", async () => {
    const machine = createJourneyMachine(createJourney());
    await machine.send({ type: "next" });
    await machine.send({ type: "back" });
    await machine.send({ type: "next" });
    expect(machine.getSnapshot().visited).toEqual(["a", "c"]);
  });

  it("supports custom events", async () => {
    const machine = createJourneyMachine(createJourney());
    await machine.send({ type: "next" });
    await machine.send({ type: "skip" });
    expect(machine.getSnapshot().current).toBe("d");
  });

  it("goTo updates history", async () => {
    const machine = createJourneyMachine(createJourney());
    await machine.send({ type: "goTo", to: "d" });
    expect(machine.getSnapshot().history).toEqual(["a"]);
    expect(machine.getSnapshot().current).toBe("d");
  });

  it("goTo to same step keeps history unchanged", async () => {
    const machine = createJourneyMachine(createJourney());
    await machine.send({ type: "goTo", to: "a" });
    expect(machine.getSnapshot().history).toEqual([]);
  });

  it("close on clean state reaches CLOSE terminal", async () => {
    const machine = createJourneyMachine(createJourney());
    await machine.send({ type: "close" });
    expect(machine.getSnapshot().status).toBe(JOURNEY_STATUS.CLOSED);
  });

  it("close on dirty state routes to confirm step", async () => {
    const machine = createJourneyMachine(createJourney());
    machine.updateContext((ctx) => ({ ...ctx, dirty: true }));
    await machine.send({ type: "close" });
    expect(machine.getSnapshot().current).toBe("confirm");
    expect(machine.getSnapshot().status).toBe(JOURNEY_STATUS.RUNNING);
  });

  it("submit from d reaches COMPLETE terminal", async () => {
    const machine = createJourneyMachine(createJourney());
    await machine.send({ type: "next" });
    await machine.send({ type: "next" });
    await machine.send({ type: "submit" });
    expect(machine.getSnapshot().status).toBe(JOURNEY_STATUS.COMPLETE);
  });

  it("stops transitioning after terminal", async () => {
    const machine = createJourneyMachine(createJourney());
    await machine.send({ type: "close" });
    const result = await machine.send({ type: "next" });
    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().current).toBe("a");
  });

  it("throws when transition points to unknown step", () => {
    const journey = createJourney();
    journey.transitions = [
      {
        from: "a",
        event: "next",
        to: "missing" as StepId
      }
    ];
    expect(() => createJourneyMachine(journey)).toThrow("unknown step");
  });

  it("throws when initial step is missing", () => {
    expect(() =>
      createJourneyMachine({
        ...createJourney(),
        initial: "missing" as StepId
      })
    ).toThrow("initial step");
  });

  it("allows updateContext before first transition", async () => {
    const machine = createJourneyMachine(createJourney());
    machine.updateContext((ctx) => ({ ...ctx, flag: true, count: 10 }));
    await machine.send({ type: "next" });
    expect(machine.getSnapshot().current).toBe("b");
    expect(machine.getSnapshot().context.count).toBe(10);
  });

  it("reset restores initial snapshot", async () => {
    const machine = createJourneyMachine(createJourney());
    machine.updateContext((ctx) => ({ ...ctx, dirty: true }));
    await machine.send({ type: "next" });
    machine.reset();
    expect(machine.getSnapshot()).toEqual({
      current: "a",
      context: { flag: false, dirty: false, count: 0, log: [] },
      history: [],
      visited: ["a"],
      status: JOURNEY_STATUS.RUNNING,
      async: asyncState()
    });
  });

  it("subscribers get called on send, updateContext, reset", async () => {
    const machine = createJourneyMachine(createJourney());
    let hits = 0;
    const unsubscribe = machine.subscribe(() => {
      hits += 1;
    });
    await machine.send({ type: "next" });
    machine.updateContext((ctx) => ({ ...ctx, count: ctx.count + 1 }));
    machine.reset();
    unsubscribe();
    expect(hits).toBe(3);
  });

  it("unsubscribe stops notifications", async () => {
    const machine = createJourneyMachine(createJourney());
    let hits = 0;
    const unsubscribe = machine.subscribe(() => {
      hits += 1;
    });
    unsubscribe();
    await machine.send({ type: "next" });
    expect(hits).toBe(0);
  });

  it("does not transition when all matching guards return false", async () => {
    const journey = createJourney();
    journey.transitions = [
      {
        from: "a",
        event: "next",
        to: "b",
        when: () => false
      },
      {
        from: "a",
        event: "next",
        to: "c",
        when: () => false
      }
    ];
    const machine = createJourneyMachine(journey);
    const result = await machine.send({ type: "next" });
    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().current).toBe("a");
  });

  it("supports async guard ordering", async () => {
    const journey = createJourney();
    const calls: string[] = [];
    journey.transitions = [
      {
        id: "first",
        from: "a",
        event: "next",
        to: "b",
        when: async () => {
          calls.push("first");
          await Promise.resolve();
          return false;
        }
      },
      {
        id: "second",
        from: "a",
        event: "next",
        to: "c",
        when: async () => {
          calls.push("second");
          return true;
        }
      }
    ];
    const machine = createJourneyMachine(journey);
    const result = await machine.send({ type: "next" });
    expect(result.transitionId).toBe("second");
    expect(calls).toEqual(["first", "second"]);
  });

  it("propagates guard errors", async () => {
    const journey = createJourney();
    journey.transitions = [
      {
        from: "a",
        event: "next",
        to: "b",
        when: () => {
          throw new Error("guard-failed");
        }
      }
    ];
    const machine = createJourneyMachine(journey);
    await expect(machine.send({ type: "next" })).rejects.toThrow("guard-failed");
  });

  it("propagates effect errors", async () => {
    const journey = createJourney();
    journey.transitions = [
      {
        from: "a",
        event: "next",
        to: "b",
        effect: () => {
          throw new Error("effect-failed");
        }
      }
    ];
    const machine = createJourneyMachine(journey);
    await expect(machine.send({ type: "next" })).rejects.toThrow("effect-failed");
  });
});
