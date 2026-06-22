import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createJourneyMachine,
  JourneyDisposedError,
  type JourneyDefinition,
  type JourneyJsonObject
} from "@rxova/journey-core";
import type {
  JourneyBaseEvent,
  JourneyStepTransitions,
  JourneyTransitionGraph
} from "../src/types";

type StepId = "start" | "middle";
type Context = { value: number };

type StartTransitions = JourneyStepTransitions<Context, StepId>;
type StartNextTransition = NonNullable<StartTransitions["goToNextStep"]>[number];

const createBaseJourney = (): JourneyDefinition<Context, StepId> => ({
  initial: "start",
  context: { value: 0 },
  steps: {
    start: {},
    middle: {}
  },
  transitions: {
    start: {
      goToNextStep: [{ label: "start-next", to: "middle" }]
    }
  }
});

const withStartNextTransition = (transition: StartNextTransition) => {
  const journey = createBaseJourney();
  const transitions = journey.transitions as JourneyTransitionGraph<Context, StepId>;
  journey.transitions = {
    ...transitions,
    start: {
      ...transitions.start,
      goToNextStep: [transition]
    }
  };
  return journey;
};

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const flushAsync = async () => {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};

const createStartedMachine = async <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never
>(
  journey: JourneyDefinition<TContext, TStepId, TEvents>
) => {
  const machine = createJourneyMachine(journey);
  await machine.startJourney();
  return machine;
};

describe("journey machine edge cases", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("tracks async guard loading state and clears it after success", async () => {
    const guard = deferred<boolean>();
    const machine = await createStartedMachine(
      withStartNextTransition({
        label: "guarded-next",
        to: "middle",
        when: async () => guard.promise
      })
    );

    const sendPromise = machine.send({ type: "goToNextStep" });
    await flushAsync();

    expect(machine.getSnapshot().async.byStep.start?.phase).toBe("evaluating-when");
    expect(machine.getSnapshot().async.isLoading).toBe(true);

    guard.resolve(true);
    const result = await sendPromise;

    expect(result.transitioned).toBe(true);
    expect(result.snapshot.currentStepId).toBe("middle");
    expect(machine.getSnapshot().async.byStep.start?.phase).toBe("idle");
    expect(machine.getSnapshot().async.isLoading).toBe(false);
  });

  it("returns a non-transitioning result when an async guard times out", async () => {
    vi.useFakeTimers();

    const machine = await createStartedMachine(
      withStartNextTransition({
        label: "guard-timeout",
        to: "middle",
        timeoutMs: 25,
        when: async () => new Promise<boolean>(() => undefined)
      })
    );

    const sendPromise = machine.send({ type: "goToNextStep" });
    await vi.advanceTimersByTimeAsync(30);
    const result = await sendPromise;

    expect(result.transitioned).toBe(false);
    expect(result.transitionId).toEqual(expect.any(String));
    expect(result.label).toBe("guard-timeout");
    expect((result.error as Error).message).toContain("Transition guard timed out after 25ms");
    expect(machine.getSnapshot().async.byStep.start?.phase).toBe("error");
    expect(machine.getSnapshot().async.isLoading).toBe(false);
  });

  it("orders updateContext behind an in-flight async guard", async () => {
    const guard = deferred<boolean>();
    const machine = await createStartedMachine(
      withStartNextTransition({
        label: "guarded-update",
        to: "middle",
        when: async () => guard.promise,
        updateContext: ({ context }) => ({ value: context.value + 1 })
      })
    );

    const sendPromise = machine.send({ type: "goToNextStep" });
    await flushAsync();

    const queuedUpdatePromise = machine.updateContext((context) => ({
      value: context.value + 100
    }));

    guard.resolve(true);
    const sendResult = await sendPromise;
    const queuedSnapshot = await queuedUpdatePromise;

    expect(sendResult.snapshot.context.value).toBe(1);
    expect(queuedSnapshot.context.value).toBe(101);
    expect(machine.getSnapshot().context.value).toBe(101);
  });

  it("clears a step error after a failed async guard", async () => {
    vi.useFakeTimers();

    const machine = await createStartedMachine(
      withStartNextTransition({
        label: "guard-timeout",
        to: "middle",
        timeoutMs: 25,
        when: async () => new Promise<boolean>(() => undefined)
      })
    );

    const sendPromise = machine.send({ type: "goToNextStep" });
    await vi.advanceTimersByTimeAsync(30);
    await sendPromise;

    expect(machine.getSnapshot().async.byStep.start?.phase).toBe("error");

    const cleared = await machine.clearStepError("start");
    expect(cleared.async.byStep.start?.phase).toBe("idle");
  });

  it("rejects non-JSON context at machine creation", () => {
    expect(() =>
      createJourneyMachine({
        initial: "start",
        context: {
          value: 0,
          bad: new Date()
        } as never,
        steps: { start: {}, middle: {} },
        transitions: {
          start: {
            goToNextStep: [{ to: "middle" }]
          }
        }
      })
    ).toThrow(/json-serializable/i);
  });

  it("rejects invalid normalized transition fields", () => {
    const invalidTransitions = [
      [{ from: "start", event: "goToNextStep", to: "middle", extra: true }],
      [{ from: "start", event: "goToNextStep", to: "middle", when: true }],
      [{ from: "start", event: "goToNextStep", to: "middle", updateContext: true }],
      [{ from: "start", event: "goToNextStep", to: "middle", onEnter: true }],
      [{ from: "start", event: "goToNextStep", to: "middle", onLeave: true }],
      [{ from: "start", event: "goToNextStep", to: "middle", id: 1 }],
      [{ from: "start", event: "goToNextStep", to: "middle", label: 1 }],
      [{ from: "start", event: "completeJourney", to: "middle" }],
      [{ from: "missing", event: "goToNextStep", to: "middle" }],
      [{ from: "start", event: 1, to: "middle" }],
      [null]
    ];

    for (const transitions of invalidTransitions) {
      expect(() =>
        createJourneyMachine({
          initial: "start",
          context: { value: 0 },
          steps: { start: {}, middle: {} },
          transitions
        } as never)
      ).toThrow();
    }
  });

  it("rejects non-JSON values returned from updateContext", async () => {
    const machine = await createStartedMachine(createBaseJourney());

    await expect(
      machine.updateContext(() => ({ value: 1, bad: undefined }) as never)
    ).rejects.toThrow(/json-serializable/i);
  });

  it("clones the initial context instead of reusing the definition object", async () => {
    const journey: JourneyDefinition<{ nested: { value: number } }, StepId> = {
      initial: "start",
      context: { nested: { value: 1 } },
      steps: { start: {}, middle: {} },
      transitions: {
        start: {
          goToNextStep: [{ to: "middle" }]
        }
      }
    };

    const machine = createJourneyMachine(journey);
    journey.context.nested.value = 99;

    expect(machine.getSnapshot().context.nested.value).toBe(1);
  });

  it("returns a disposed error for send-style APIs after dispose", async () => {
    const machine = await createStartedMachine(createBaseJourney());
    machine.dispose();

    const result = await machine.send({ type: "goToNextStep" });

    expect(result.transitioned).toBe(false);
    expect(result.error).toBeInstanceOf(JourneyDisposedError);
  });
});
