import { describe, expect, it } from "vitest";

import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "mid" | "end";
type Event = "goToNextStep" | "back";
type Context = { count: number };

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const createJourney = (
  midEffect?: (context: Context) => Promise<Context>
): JourneyDefinition<Context, StepId, Event> => ({
  initial: "start",
  context: { count: 0 },
  steps: {
    start: {},
    mid: {},
    end: {}
  },
  transitions: [
    { from: "start", event: "goToNextStep", to: "mid" },
    {
      from: "mid",
      event: "goToNextStep",
      to: "end",
      ...(midEffect
        ? {
            effect: ({ context }: { context: Context }) => midEffect(context)
          }
        : {})
    }
  ]
});

describe("action queue resilience", () => {
  it("serializes overlapping sends and keeps timeline consistent", async () => {
    const block = deferred<Context>();
    const machine = createJourneyMachine(
      createJourney(async (context) => {
        const next = await block.promise;
        return { ...context, count: next.count };
      })
    );

    await machine.send({ type: "goToNextStep" });

    const inFlight = machine.send({ type: "goToNextStep" });
    const queuedBack = machine.send({ type: "back" });

    block.resolve({ count: 9 });

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
