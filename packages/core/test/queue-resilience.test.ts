import { describe, expect, it } from "vitest";

import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "mid" | "end";
type EventMap = { back: unknown };
type Context = { count: number };

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const createJourney = (
  midGuard?: () => Promise<number>
): JourneyDefinition<Context, StepId, EventMap> => {
  let resolvedCount = 0;

  return {
    initial: "start",
    context: { count: 0 },
    steps: {
      start: {},
      mid: {},
      end: {}
    },
    transitions: {
      start: { goToNextStep: [{ to: "mid" }] },
      mid: {
        goToNextStep: [
          {
            to: "end",
            ...(midGuard
              ? {
                  when: async () => {
                    resolvedCount = await midGuard();
                    return true;
                  },
                  updateContext: ({ context }: { context: Context }) => ({
                    ...context,
                    count: resolvedCount
                  })
                }
              : {})
          }
        ]
      }
    }
  };
};

describe("action queue resilience", () => {
  it("serializes overlapping sends and keeps timeline consistent", async () => {
    const block = deferred<number>();
    const machine = createJourneyMachine(createJourney(async () => await block.promise));
    await machine.start();

    await machine.send({ type: "goToNextStep" });

    const inFlight = machine.send({ type: "goToNextStep" });
    const queuedBack = machine.goToPreviousStep();

    block.resolve(9);

    await inFlight;
    await queuedBack;

    const snapshot = machine.getSnapshot();
    expect(snapshot.currentStepId).toBe("mid");
    expect(snapshot.history.timeline).toEqual(["start", "mid", "end"]);
    expect(snapshot.history.index).toBe(1);
    expect(snapshot.context.count).toBe(9);
  });

  it("queues goToPreviousStep after transition send", async () => {
    const machine = createJourneyMachine(createJourney());
    await machine.start();

    const nextA = machine.send({ type: "goToNextStep" });
    const nextB = machine.send({ type: "goToNextStep" });
    const back = machine.goToPreviousStep(2);

    await Promise.all([nextA, nextB, back]);

    const snapshot = machine.getSnapshot();
    expect(snapshot.currentStepId).toBe("start");
    expect(snapshot.history.index).toBe(0);
    expect(snapshot.history.timeline).toEqual(["start", "mid", "end"]);
  });
});
