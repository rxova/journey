import { describe, expect, it } from "vitest";

import { createGraphJourney, createLinearJourney } from "@rxova/journey-core";
import { createSubscriptionEnhancerPlugin } from "@rxova/journey-core/subscription-enhancer";

type StepId = "start" | "details" | "review";
type Context = { count: number };

const createMachine = () =>
  createGraphJourney(
    {
      initial: "start" as StepId,
      context: { count: 0 } as Context,
      steps: { start: {}, details: {}, review: {} },
      transitions: {
        start: { goToNextStep: [{ to: "details" }] },
        details: { goToNextStep: [{ to: "review" }] }
      }
    },
    { plugins: [createSubscriptionEnhancerPlugin<StepId>()] as const }
  );

const createStartedMachine = async () => {
  const machine = createMachine();
  await machine.controls.start();
  return machine;
};

describe("subscription-enhancer plugin", () => {
  it("subscribeStart filters to startup events", async () => {
    const machine = createMachine();
    const events: Array<{ stepId: StepId; timestamp: number }> = [];

    machine.subscribeStart((event) => {
      events.push({ stepId: event.stepId, timestamp: event.timestamp });
    });

    await machine.controls.start();
    await machine.goToNextStep();

    expect(events).toEqual([
      {
        stepId: "start",
        timestamp: expect.any(Number)
      }
    ]);
  });

  it("subscribeReset filters to reset events and respects unsubscribe", async () => {
    const machine = await createStartedMachine();
    const events: Array<{ stepId: StepId; timestamp: number }> = [];
    const unsubscribe = machine.subscribeReset((event) => {
      events.push({ stepId: event.stepId, timestamp: event.timestamp });
    });

    await machine.controls.reset();

    expect(events).toEqual([
      {
        stepId: "start",
        timestamp: expect.any(Number)
      }
    ]);

    unsubscribe();
    await machine.controls.start();
    await machine.controls.reset();

    expect(events).toHaveLength(1);
  });

  it("subscribeComplete filters to terminal completion events", async () => {
    const machine = await createStartedMachine();
    const events: Array<{ stepId: StepId; timestamp: number }> = [];

    machine.subscribeComplete((event) => {
      events.push({ stepId: event.stepId, timestamp: event.timestamp });
    });

    await machine.goToNextStep();
    await machine.goToNextStep();

    expect(events).toEqual([]);

    await machine.controls.complete();

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      stepId: "review",
      timestamp: expect.any(Number)
    });
  });

  it("subscribeTerminate filters to terminal close events and respects unsubscribe", async () => {
    const machine = await createStartedMachine();
    const events: Array<{ stepId: StepId; timestamp: number }> = [];
    const unsubscribe = machine.subscribeTerminate((event) => {
      events.push({ stepId: event.stepId, timestamp: event.timestamp });
    });

    unsubscribe();
    await machine.controls.terminate();

    expect(events).toEqual([]);

    const activeMachine = await createStartedMachine();
    const activeEvents: Array<{ stepId: StepId; timestamp: number }> = [];
    activeMachine.subscribeTerminate((event) => {
      activeEvents.push({ stepId: event.stepId, timestamp: event.timestamp });
    });

    await activeMachine.controls.terminate();

    expect(activeEvents).toHaveLength(1);
    expect(activeEvents[0]).toEqual({
      stepId: "start",
      timestamp: expect.any(Number)
    });
  });

  it("augments the linear runtime identically", async () => {
    const machine = createLinearJourney(
      { context: { count: 0 } as Context, steps: ["start", "details", "review"] as const },
      { plugins: [createSubscriptionEnhancerPlugin<StepId>()] as const }
    );
    const seen: string[] = [];
    machine.subscribeStart(() => void seen.push("start"));
    machine.subscribeReset(() => void seen.push("reset"));
    machine.subscribeComplete(() => void seen.push("complete"));
    machine.subscribeTerminate(() => void seen.push("terminate"));

    await machine.controls.start();
    await machine.controls.complete();
    await machine.controls.reset();
    await machine.controls.start();
    await machine.controls.terminate();

    expect(seen).toEqual(["start", "complete", "reset", "start", "terminate"]);
  });
});
