import { describe, expect, it } from "vitest";

import {
  createJourneyMachine,
  type JourneyDefaultEventType,
  type JourneyDefinition,
  type JourneyObservationEvent
} from "@rxova/journey-core";

type StepId = "start" | "middle";
type Event = JourneyDefaultEventType;
type Context = { value: number };

const createBaseJourney = (): JourneyDefinition<Context, StepId, Event> => ({
  initial: "start",
  context: { value: 0 },
  steps: {
    start: { meta: { title: "Start" } },
    middle: { meta: { title: "Middle" } }
  },
  transitions: [{ id: "start-next", from: "start", event: "goToNextStep", to: "middle" }]
});

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

describe("machine edge cases", () => {
  it("tracks async guard loading state and clears it after success", async () => {
    const guard = deferred<boolean>();
    const machine = createJourneyMachine({
      ...createBaseJourney(),
      transitions: [
        {
          id: "guarded-next",
          from: "start",
          event: "goToNextStep",
          to: "middle",
          when: async () => guard.promise
        }
      ]
    });

    const sendPromise = machine.send({ type: "goToNextStep" });
    await flushAsync();

    const loadingSnapshot = machine.getSnapshot();
    expect(loadingSnapshot.async.byStep.start.phase).toBe("evaluating-when");
    expect(loadingSnapshot.async.byStep.start.eventType).toBe("goToNextStep");
    expect(loadingSnapshot.async.byStep.start.transitionId).toBe("guarded-next");
    expect(loadingSnapshot.async.isLoading).toBe(true);

    guard.resolve(true);
    await sendPromise;

    const finalSnapshot = machine.getSnapshot();
    expect(finalSnapshot.currentStepId).toBe("middle");
    expect(finalSnapshot.async.byStep.start.phase).toBe("idle");
    expect(finalSnapshot.async.byStep.start.transitionId).toBeNull();
    expect(finalSnapshot.async.isLoading).toBe(false);
  });

  it("returns a non-transitioning send result when an async guard rejects", async () => {
    const machine = createJourneyMachine({
      ...createBaseJourney(),
      transitions: [
        {
          id: "guard-reject",
          from: "start",
          event: "goToNextStep",
          to: "middle",
          when: async () => {
            throw new Error("guard failed");
          }
        }
      ]
    });
    const events: JourneyObservationEvent<StepId, Event>[] = [];
    machine.subscribeEvent((event) => {
      events.push(event);
    });

    const result = await machine.send({ type: "goToNextStep" });

    expect(result.transitioned).toBe(false);
    expect(result.transitionId).toBeUndefined();
    expect(result.error).toBeInstanceOf(Error);
    expect((result.error as Error).message).toBe("guard failed");

    const transitionError = events.find((event) => event.type === "transition.error");
    expect(transitionError?.type).toBe("transition.error");
    if (transitionError?.type === "transition.error") {
      expect(transitionError.transitionId).toBeNull();
      expect(transitionError.eventType).toBe("goToNextStep");
    }

    const snapshot = machine.getSnapshot();
    expect(snapshot.async.byStep.start.phase).toBe("error");
    expect(snapshot.async.byStep.start.transitionId).toBeNull();
    expect((snapshot.async.byStep.start.error as Error).message).toBe("guard failed");
  });

  it("returns a non-transitioning send result when an async effect rejects", async () => {
    const effectGate = deferred<Context>();
    const machine = createJourneyMachine({
      ...createBaseJourney(),
      transitions: [
        {
          id: "effect-reject",
          from: "start",
          event: "goToNextStep",
          to: "middle",
          effect: async () => effectGate.promise
        }
      ]
    });
    const events: JourneyObservationEvent<StepId, Event>[] = [];
    machine.subscribeEvent((event) => {
      events.push(event);
    });

    const sendPromise = machine.send({ type: "goToNextStep" });
    await flushAsync();
    expect(machine.getSnapshot().async.byStep.start.phase).toBe("running-effect");
    effectGate.reject(new Error("effect failed"));

    const result = await sendPromise;

    expect(result.transitioned).toBe(false);
    expect(result.transitionId).toBe("effect-reject");
    expect(result.error).toBeInstanceOf(Error);
    expect((result.error as Error).message).toBe("effect failed");

    const transitionError = events.find((event) => event.type === "transition.error");
    expect(transitionError?.type).toBe("transition.error");
    if (transitionError?.type === "transition.error") {
      expect(transitionError.transitionId).toBe("effect-reject");
    }

    const snapshot = machine.getSnapshot();
    expect(snapshot.async.byStep.start.phase).toBe("error");
    expect(snapshot.async.byStep.start.transitionId).toBe("effect-reject");
  });

  it("returns a non-transitioning send result when a sync guard throws", async () => {
    const machine = createJourneyMachine({
      ...createBaseJourney(),
      transitions: [
        {
          id: "guard-throw",
          from: "start",
          event: "goToNextStep",
          to: "middle",
          when: () => {
            throw new Error("guard failed");
          }
        }
      ]
    });

    const result = await machine.send({ type: "goToNextStep" });

    expect(result.transitioned).toBe(false);
    expect(result.transitionId).toBeUndefined();
    expect(result.error).toBeInstanceOf(Error);
    expect((result.error as Error).message).toBe("guard failed");
    expect(machine.getSnapshot().async.byStep.start.phase).toBe("error");
    expect((machine.getSnapshot().async.byStep.start.error as Error).message).toBe("guard failed");
  });

  it("returns a non-transitioning send result when a sync effect throws", async () => {
    const machine = createJourneyMachine({
      ...createBaseJourney(),
      transitions: [
        {
          id: "effect-throw",
          from: "start",
          event: "goToNextStep",
          to: "middle",
          effect: () => {
            throw new Error("effect failed");
          }
        }
      ]
    });

    const result = await machine.send({ type: "goToNextStep" });

    expect(result.transitioned).toBe(false);
    expect(result.transitionId).toBe("effect-throw");
    expect(result.error).toBeInstanceOf(Error);
    expect((result.error as Error).message).toBe("effect failed");
    expect(machine.getSnapshot().async.byStep.start.phase).toBe("error");
    expect(machine.getSnapshot().async.byStep.start.transitionId).toBe("effect-throw");
    expect((machine.getSnapshot().async.byStep.start.error as Error).message).toBe("effect failed");
  });

  it("resetMachine cancels in-flight async effects and ignores stale completion", async () => {
    const effectGate = deferred<Context>();
    const machine = createJourneyMachine({
      ...createBaseJourney(),
      transitions: [
        {
          id: "effect-cancel",
          from: "start",
          event: "goToNextStep",
          to: "middle",
          effect: async () => effectGate.promise
        }
      ]
    });
    const events: JourneyObservationEvent<StepId, Event>[] = [];
    machine.subscribeEvent((event) => {
      events.push(event);
    });

    const sendPromise = machine.send({ type: "goToNextStep" });
    await flushAsync();
    expect(machine.getSnapshot().async.byStep.start.phase).toBe("running-effect");

    machine.resetMachine();
    expect(machine.getSnapshot().currentStepId).toBe("start");
    expect(machine.getSnapshot().async.byStep.start.phase).toBe("idle");

    effectGate.resolve({ value: 42 });
    const result = await sendPromise;

    expect(result.transitioned).toBe(false);
    const snapshot = machine.getSnapshot();
    expect(snapshot.currentStepId).toBe("start");
    expect(snapshot.history.timeline).toEqual(["start"]);
    expect(snapshot.context.value).toBe(0);
    expect(events.some((event) => event.type === "transition.success")).toBe(false);
  });

  it("dispose cancels in-flight transitions and blocks future sends", async () => {
    const effectGate = deferred<Context>();
    const machine = createJourneyMachine({
      ...createBaseJourney(),
      transitions: [
        {
          id: "effect-dispose",
          from: "start",
          event: "goToNextStep",
          to: "middle",
          effect: async () => effectGate.promise
        }
      ]
    });

    const sendPromise = machine.send({ type: "goToNextStep" });
    await flushAsync();
    expect(machine.getSnapshot().async.byStep.start.phase).toBe("running-effect");

    machine.dispose();

    effectGate.resolve({ value: 11 });
    const inFlightResult = await sendPromise;
    expect(inFlightResult.transitioned).toBe(false);

    const nextResult = await machine.send({ type: "goToNextStep" });
    expect(nextResult.transitioned).toBe(false);
    expect(machine.getSnapshot().currentStepId).toBe("start");
  });

  it("swallows stale async guard errors after reset cancellation", async () => {
    const guardGate = deferred<boolean>();
    const machine = createJourneyMachine({
      ...createBaseJourney(),
      transitions: [
        {
          id: "guard-reset-reject",
          from: "start",
          event: "goToNextStep",
          to: "middle",
          when: async () => guardGate.promise
        }
      ]
    });

    const sendPromise = machine.send({ type: "goToNextStep" });
    await flushAsync();
    machine.resetMachine();

    guardGate.reject(new Error("guard failed after reset"));
    const result = await sendPromise;

    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().currentStepId).toBe("start");
  });

  it("swallows stale async effect errors after reset cancellation", async () => {
    const effectGate = deferred<Context>();
    const machine = createJourneyMachine({
      ...createBaseJourney(),
      transitions: [
        {
          id: "effect-reset-reject",
          from: "start",
          event: "goToNextStep",
          to: "middle",
          effect: async () => effectGate.promise
        }
      ]
    });

    const sendPromise = machine.send({ type: "goToNextStep" });
    await flushAsync();
    machine.resetMachine();

    effectGate.reject(new Error("effect failed after reset"));
    const result = await sendPromise;

    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().currentStepId).toBe("start");
  });

  it("goToStepById falls back to direct jumps when no matching transitions are declared", async () => {
    const machine = createJourneyMachine(createBaseJourney());

    const first = await machine.send({ type: "goToStepById", stepId: "middle" });
    expect(first.transitioned).toBe(true);
    expect(first.transitionId).toBe("goToStepById");
    expect(machine.getSnapshot().currentStepId).toBe("middle");

    const second = await machine.send({ type: "goToStepById", stepId: "middle" });
    expect(second.transitioned).toBe(true);
    expect(second.transitionId).toBe("goToStepById");
    expect(machine.getSnapshot().history.timeline).toEqual(["start", "middle"]);
  });

  it("goToStepById runs guards/effects when matching transitions are defined", async () => {
    const machine = createJourneyMachine({
      ...createBaseJourney(),
      transitions: [
        {
          id: "go-to-middle-transition",
          from: "start",
          event: "goToStepById",
          to: "middle",
          when: ({ event }) => "stepId" in event && event.stepId === "middle",
          effect: ({ context }) => ({ value: context.value + 5 })
        }
      ]
    });
    const events: JourneyObservationEvent<StepId, Event>[] = [];
    machine.subscribeEvent((event) => {
      events.push(event);
    });

    const result = await machine.send({ type: "goToStepById", stepId: "middle" });

    expect(result.transitioned).toBe(true);
    expect(result.transitionId).toBe("go-to-middle-transition");
    expect(machine.getSnapshot().currentStepId).toBe("middle");
    expect(machine.getSnapshot().context.value).toBe(5);
    expect(events.map((event) => event.type)).toEqual([
      "journey.start",
      "transition.start",
      "step.exit",
      "transition.success",
      "step.enter"
    ]);
  });

  it("goToStepById does not fallback-jump when matching transition guards block navigation", async () => {
    const machine = createJourneyMachine({
      ...createBaseJourney(),
      transitions: [
        {
          id: "go-to-middle-blocked",
          from: "start",
          event: "goToStepById",
          to: "middle",
          when: () => false
        }
      ]
    });

    const result = await machine.send({ type: "goToStepById", stepId: "middle" });

    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().currentStepId).toBe("start");
    expect(machine.getSnapshot().history.timeline).toEqual(["start"]);
  });

  it("keeps context unchanged when effect returns undefined", async () => {
    const machine = createJourneyMachine({
      ...createBaseJourney(),
      transitions: [
        {
          id: "effect-undefined",
          from: "start",
          event: "goToNextStep",
          to: "middle",
          effect: async () => undefined
        }
      ]
    });

    const before = machine.getSnapshot().context;
    await machine.send({ type: "goToNextStep" });

    expect(machine.getSnapshot().context).toEqual(before);
  });

  it("returns non-transitioning result when no transition matches a non-back event", async () => {
    const machine = createJourneyMachine(createBaseJourney());

    const result = await machine.send({ type: "completeJourney" });
    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().currentStepId).toBe("start");
  });

  it("completes on goToNextStep when no next transition is declared by default", async () => {
    const machine = createJourneyMachine(createBaseJourney());
    const events: JourneyObservationEvent<StepId, Event>[] = [];

    machine.subscribeEvent((event) => {
      events.push(event);
    });

    await machine.goToNextStep();
    const result = await machine.goToNextStep();

    expect(result.transitioned).toBe(true);
    expect(result.transitionId).toBeUndefined();
    expect(result.snapshot.status).toBe("complete");
    expect(result.snapshot.currentStepId).toBe("middle");
    expect(events.map((event) => event.type)).toEqual([
      "journey.start",
      "transition.start",
      "step.exit",
      "transition.success",
      "step.enter",
      "transition.start",
      "transition.success",
      "journey.complete"
    ]);
    expect(events[6]).toMatchObject({
      type: "transition.success",
      from: "middle",
      to: "COMPLETE",
      eventType: "goToNextStep",
      transitionId: null
    });
    expect(events[7]).toMatchObject({
      type: "journey.complete",
      stepId: "middle"
    });
  });

  it("can opt out of goToNextStep auto-completion", async () => {
    const machine = createJourneyMachine(createBaseJourney(), {
      completeOnNoNextStep: false
    });

    await machine.goToNextStep();
    const result = await machine.goToNextStep();

    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().status).toBe("running");
    expect(machine.getSnapshot().currentStepId).toBe("middle");
  });

  it("does not auto-complete when a declared next transition is blocked by guards", async () => {
    const machine = createJourneyMachine(
      {
        ...createBaseJourney(),
        transitions: [
          {
            id: "blocked-next",
            from: "middle",
            event: "goToNextStep",
            to: "start",
            when: () => false
          },
          ...createBaseJourney().transitions
        ]
      },
      {
        completeOnNoNextStep: true
      }
    );

    await machine.goToNextStep();
    const result = await machine.goToNextStep();

    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().status).toBe("running");
    expect(machine.getSnapshot().currentStepId).toBe("middle");
  });

  it("no-ops subscriptions and sync APIs after dispose", async () => {
    const machine = createJourneyMachine(createBaseJourney());
    const before = machine.getSnapshot();

    machine.dispose();
    machine.dispose();

    const unsubscribe = machine.subscribe(() => {
      throw new Error("disposed subscribe should be noop");
    });
    const unsubscribeEvent = machine.subscribeEvent(() => {
      throw new Error("disposed subscribeEvent should be noop");
    });

    expect(machine.resetMachine()).toBe(before);
    expect(machine.updateContext((context) => ({ ...context, value: context.value + 1 }))).toBe(
      before
    );
    expect(machine.updateStepMetadata("start", (meta) => meta)).toBe(before);
    expect(machine.clearStepError()).toBe(before);

    const result = await machine.goToNextStep();
    expect(result.transitioned).toBe(false);
    expect(result.snapshot).toBe(before);

    unsubscribe();
    unsubscribeEvent();
  });

  it("throws when updateContext updater returns undefined", () => {
    const machine = createJourneyMachine(createBaseJourney());
    const before = machine.getSnapshot();

    expect(() => {
      machine.updateContext(() => undefined as unknown as Context);
    }).toThrow(/updateContext updater must return a context value/);

    expect(machine.getSnapshot()).toBe(before);
  });

  it("throws when updateStepMetadata updater returns undefined", () => {
    const machine = createJourneyMachine(createBaseJourney());
    const before = machine.getSnapshot();

    expect(() => {
      machine.updateStepMetadata("start", () => undefined as unknown);
    }).toThrow(/updateStepMetadata updater must return a metadata value/);

    expect(machine.getSnapshot()).toBe(before);
  });

  it("recovers missing async step state when an async guard rejects", async () => {
    const machine = createJourneyMachine({
      ...createBaseJourney(),
      transitions: [
        {
          from: "start",
          event: "goToNextStep",
          to: "middle",
          when: async () => {
            throw new Error("guard failed");
          }
        }
      ]
    });

    const leakedSnapshot = machine.getSnapshot() as {
      async: { byStep: Record<string, unknown> };
    };
    delete leakedSnapshot.async.byStep.start;

    const result = await machine.send({ type: "goToNextStep" });
    expect(result.error).toBeInstanceOf(Error);
    expect(machine.getSnapshot().async.byStep.start.phase).toBe("error");
  });

  it("reports null transitionId when an async effect rejects without transition id", async () => {
    const machine = createJourneyMachine({
      ...createBaseJourney(),
      transitions: [
        {
          from: "start",
          event: "goToNextStep",
          to: "middle",
          effect: async () => {
            throw new Error("effect failed");
          }
        }
      ]
    });
    const events: JourneyObservationEvent<StepId, Event>[] = [];
    machine.subscribeEvent((event) => {
      events.push(event);
    });

    const result = await machine.send({ type: "goToNextStep" });
    expect(result.error).toBeInstanceOf(Error);

    const transitionError = events.find((event) => event.type === "transition.error");
    expect(transitionError?.type).toBe("transition.error");
    if (transitionError?.type === "transition.error") {
      expect(transitionError.transitionId).toBeNull();
    }
  });

  it("no-ops metadata and clearStepError calls for unknown or unchanged steps", () => {
    const machine = createJourneyMachine(createBaseJourney());
    const before = machine.getSnapshot();
    const observed: string[] = [];
    machine.subscribeEvent((event) => {
      observed.push(event.type);
    });
    observed.length = 0;

    const unknownMetadata = machine.updateStepMetadata("missing" as StepId, () => ({
      title: "ignored"
    }));
    const unchangedMetadata = machine.updateStepMetadata("start", (meta) => meta);
    const unknownErrorClear = machine.clearStepError("missing" as StepId);

    expect(unknownMetadata).toBe(before);
    expect(unchangedMetadata).toBe(before);
    expect(unknownErrorClear).toBe(before);
    expect(observed).toEqual([]);
  });

  it("returns non-transitioning previous navigation result for corrupted negative index", async () => {
    const machine = createJourneyMachine(createBaseJourney());
    const leakedSnapshot = machine.getSnapshot() as { history: { index: number } };
    leakedSnapshot.history.index = -1;

    const result = await machine.goToPreviousStep(1);
    expect(result.transitioned).toBe(false);
    expect(result.snapshot).toBe(leakedSnapshot);
  });

  it("clearStepError resets current step async state from error to idle", async () => {
    const machine = createJourneyMachine({
      ...createBaseJourney(),
      transitions: [
        {
          id: "guard-reject",
          from: "start",
          event: "goToNextStep",
          to: "middle",
          when: async () => {
            throw new Error("guard failed");
          }
        }
      ]
    });

    const result = await machine.send({ type: "goToNextStep" });
    expect(result.error).toBeInstanceOf(Error);
    expect(machine.getSnapshot().async.byStep.start.phase).toBe("error");

    const cleared = machine.clearStepError();
    expect(cleared.async.byStep.start.phase).toBe("idle");
    expect(cleared.async.byStep.start.eventType).toBeNull();
    expect(cleared.async.byStep.start.transitionId).toBeNull();
    expect(cleared.async.byStep.start.error).toBeNull();
  });

  it("does not retain unsubscribed snapshot listeners after churn", () => {
    const machine = createJourneyMachine(createBaseJourney());
    const calls = new Array(200).fill(0);
    const unsubs: Array<() => void> = [];

    for (let index = 0; index < 200; index += 1) {
      unsubs.push(
        machine.subscribe(() => {
          calls[index] += 1;
        })
      );
    }

    for (const unsubscribe of unsubs) {
      unsubscribe();
    }

    machine.updateContext((context) => ({ ...context, value: context.value + 1 }));
    expect(calls.every((count) => count === 0)).toBe(true);

    let retainedCalls = 0;
    const unsubscribeRetained = machine.subscribe(() => {
      retainedCalls += 1;
    });

    machine.updateContext((context) => ({ ...context, value: context.value + 1 }));
    expect(retainedCalls).toBe(1);

    unsubscribeRetained();
    machine.updateContext((context) => ({ ...context, value: context.value + 1 }));
    expect(retainedCalls).toBe(1);
  });

  it("does not retain unsubscribed event listeners after churn", () => {
    const machine = createJourneyMachine(createBaseJourney());
    const calls = new Array(200).fill(0);
    const unsubs: Array<() => void> = [];

    for (let index = 0; index < 200; index += 1) {
      unsubs.push(
        machine.subscribeEvent(() => {
          calls[index] += 1;
        })
      );
    }
    calls.fill(0);

    for (const unsubscribe of unsubs) {
      unsubscribe();
    }

    machine.updateStepMetadata("start", () => ({ title: "Start-v2" }));
    expect(calls.every((count) => count === 0)).toBe(true);

    let retainedCalls = 0;
    const unsubscribeRetained = machine.subscribeEvent(() => {
      retainedCalls += 1;
    });
    retainedCalls = 0;

    machine.updateStepMetadata("start", () => ({ title: "Start-v3" }));
    expect(retainedCalls).toBe(1);

    unsubscribeRetained();
    machine.updateStepMetadata("start", () => ({ title: "Start-v4" }));
    expect(retainedCalls).toBe(1);
  });
});
