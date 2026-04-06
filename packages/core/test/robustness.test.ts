import { describe, expect, it, vi } from "vitest";

import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "s0" | "s1" | "s2";
type EventMap = { back: unknown };
type Context = { value: number };

const baseJourney = (): JourneyDefinition<Context, StepId, EventMap> => ({
  initial: "s0",
  context: { value: 0 },
  steps: {
    s0: {},
    s1: {},
    s2: {}
  },
  transitions: {
    s0: { goToNextStep: [{ to: "s1" }] },
    s1: { goToNextStep: [{ to: "s2" }] },
    s2: { completeJourney: [{}] }
  }
});

const withNodeEnv = async (value: string | undefined, run: () => void | Promise<void>) => {
  const previous = process.env.NODE_ENV;

  if (value === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = value;
  }

  try {
    await run();
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previous;
    }
  }
};

describe("robustness", () => {
  it("throws when steps are not a record object", () => {
    const journey = baseJourney();
    expect(() =>
      createJourneyMachine({
        ...journey,
        steps: null as unknown as JourneyDefinition<Context, StepId, EventMap>["steps"]
      })
    ).toThrow(/steps must be a record object/i);
  });

  it("throws when transitions are neither an array nor an object", () => {
    const journey = baseJourney();
    expect(() =>
      createJourneyMachine({
        ...journey,
        transitions: null as never
      })
    ).toThrow(/transitions must be an array or an object map/i);
  });

  it("throws when a transition entry is not an object", () => {
    const journey = baseJourney();
    journey.transitions = {
      s0: {
        goToNextStep: [null as never]
      }
    };

    expect(() => createJourneyMachine(journey)).toThrow(/s0\.goToNextStep\[0\].*object/i);
  });

  it("throws when a transition event entry is not an array", () => {
    const journey = baseJourney();
    journey.transitions = {
      s0: {
        goToNextStep: { to: "s1" } as never
      }
    };

    expect(() => createJourneyMachine(journey)).toThrow(/s0\.goToNextStep.*must be an array/i);
  });

  it("throws on unknown graph keys", () => {
    const journey = baseJourney();
    journey.transitions = { missing: { goToNextStep: [{ to: "s1" }] } } as never;

    expect(() => createJourneyMachine(journey)).toThrow(/unknown step "missing"/i);
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
    journey.transitions = {
      s0: {
        goToNextStep: [{ to: "missing" as StepId }]
      }
    };

    expect(() => createJourneyMachine(journey)).toThrow(/unknown step/i);
  });

  it('throws when "completeJourney" transition defines "to"', () => {
    const journey = baseJourney();
    journey.transitions = {
      s0: { goToNextStep: [{ to: "s1" }] },
      s1: { goToNextStep: [{ to: "s2" }] },
      s2: {
        completeJourney: [{ to: "s2" } as never]
      }
    };

    expect(() => createJourneyMachine(journey)).toThrow(
      /completeJourney\[0\]".*unsupported field "to"/i
    );
  });

  it('throws when "when" is present but not a function', () => {
    const journey = baseJourney();
    journey.transitions = {
      s0: {
        goToNextStep: [{ to: "s1", when: true } as never]
      }
    };

    expect(() => createJourneyMachine(journey)).toThrow(/"when" as a function/i);
  });

  it('throws when "updateContext" is present but not a function', () => {
    const journey = baseJourney();
    journey.transitions = {
      s0: {
        goToNextStep: [{ to: "s1", updateContext: "nope" } as never]
      }
    };

    expect(() => createJourneyMachine(journey)).toThrow(/"updateContext" as a function/i);
  });

  it('throws on unsupported authored "id" fields', () => {
    const journey = baseJourney();
    journey.transitions = {
      s0: {
        goToNextStep: [{ to: "s1", id: 123 } as never]
      }
    };

    expect(() => createJourneyMachine(journey)).toThrow(/unsupported field "id"/i);
  });

  it("throws on unsupported graph transition fields", () => {
    const journey = baseJourney();
    journey.transitions = {
      s0: {
        goToNextStep: [{ to: "s1", debug: true } as never]
      }
    };

    expect(() => createJourneyMachine(journey)).toThrow(/unsupported field "debug"/i);
  });

  it("no-ops previous navigation at index zero", async () => {
    const machine = createJourneyMachine(baseJourney());

    const result = await machine.goToPreviousStep(2);

    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().currentStepId).toBe("s0");
    expect(machine.getSnapshot().history.index).toBe(0);
  });

  it("calls onListenerError when a snapshot listener throws, without blocking other listeners", async () => {
    const onListenerError = vi.fn();
    const machine = createJourneyMachine(baseJourney(), { onListenerError });
    await machine.startJourney();

    const listener1 = vi.fn(() => {
      throw new Error("listener1 failed");
    });
    const listener2 = vi.fn();
    machine.subscribe(listener1);
    machine.subscribe(listener2);

    await machine.updateContext((c) => ({ ...c, value: 1 }));

    expect(listener2).toHaveBeenCalled();
    expect(onListenerError).toHaveBeenCalledWith(expect.any(Error), "snapshot");
  });

  it("calls onListenerError when an event listener throws, without blocking other listeners", async () => {
    const onListenerError = vi.fn();
    const machine = createJourneyMachine(baseJourney(), { onListenerError });
    await machine.startJourney();

    const listener1 = vi.fn(() => {
      throw new Error("event-listener failed");
    });
    const listener2 = vi.fn();
    machine.subscribeEvent(listener1);
    machine.subscribeEvent(listener2);

    await machine.goToNextStep();

    expect(listener2).toHaveBeenCalled();
    expect(onListenerError).toHaveBeenCalledWith(expect.any(Error), "event");
  });

  it("defaults listener errors to console.error in development when no handler is provided", async () => {
    await withNodeEnv("development", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const machine = createJourneyMachine(baseJourney());
      await machine.startJourney();

      machine.subscribe(() => {
        throw new Error("listener failed");
      });

      await machine.updateContext((context) => ({ ...context, value: context.value + 1 }));

      expect(errorSpy).toHaveBeenCalledWith(
        "Journey snapshot listener threw an error.",
        expect.any(Error)
      );
      errorSpy.mockRestore();
    });
  });

  it("keeps default listener diagnostics quiet in production", async () => {
    await withNodeEnv("production", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const machine = createJourneyMachine(baseJourney());
      await machine.startJourney();

      machine.subscribe(() => {
        throw new Error("listener failed");
      });

      await machine.updateContext((context) => ({ ...context, value: context.value + 1 }));

      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  it("leaves explicit custom back sends as no-ops after terminal status when no transition exists", async () => {
    const machine = createJourneyMachine(baseJourney());
    machine.startJourney();

    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "completeJourney" });

    const result = await machine.send({ type: "back" });

    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().currentStepId).toBe("s2");
  });
});
