import { describe, expect, it } from "vitest";
import { createGraphJourney, createLinearJourney } from "@rxova/journey-core";
import { flush } from "@rxova/journey-core/testing";

describe("snapshot structural sharing", () => {
  it("preserves sub-object identity across an unrelated context change (linear)", async () => {
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: { n: 0 } },
      { autoStart: true }
    );
    await flush();

    const before = machine.getSnapshot();
    machine.context.update((context) => ({ ...context, n: 1 }));
    const after = machine.getSnapshot();

    expect(after).not.toBe(before);
    expect(after.context).toEqual({ n: 1 });
    // Everything the change did not touch keeps its reference.
    expect(after.currentStep).toBe(before.currentStep);
    expect(after.history).toBe(before.history);
    expect(after.machine).toBe(before.machine);
    expect(after.transition).toBe(before.transition);
    expect(after.steps).toBe(before.steps);
  });

  it("returns the identical snapshot object when nothing changed at all", async () => {
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: { n: 0 } },
      { autoStart: true }
    );
    await flush();

    const before = machine.getSnapshot();
    machine.context.update((context) => context); // no-op updater
    expect(machine.getSnapshot()).toBe(before);
  });

  it("does not notify selector subscribers for a content-identical publish", async () => {
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: { n: 0 } },
      { autoStart: true }
    );
    await flush();

    const notifications: unknown[] = [];
    machine.subscriptions.subscribeSelector(
      (snapshot) => snapshot,
      (selected) => notifications.push(selected)
    );
    machine.context.update((context) => context); // no-op
    expect(notifications).toHaveLength(0);
    machine.context.update((context) => ({ ...context, n: 1 }));
    expect(notifications).toHaveLength(1);
  });

  it("keeps step order and transition arrays shared across moves (graph)", async () => {
    const machine = createGraphJourney(
      {
        steps: { form: {}, review: {} },
        transitions: { SUBMIT: { from: "form", to: "review" } },
        initial: "form",
        context: { attempts: 0 }
      },
      { autoStart: true }
    );
    await flush();

    const before = machine.getSnapshot();
    machine.context.update((context) => ({ ...context, attempts: 1 }));
    const after = machine.getSnapshot();

    // No guards read context, so the routing surface is untouched.
    expect(after.currentStep).toBe(before.currentStep);
    expect(after.outgoingTransitions).toBe(before.outgoingTransitions);
    expect(after.availableEvents).toBe(before.availableEvents);
    expect(after.availableSteps).toBe(before.availableSteps);
    expect(after.declaredEvents).toBe(before.declaredEvents);
  });
});
