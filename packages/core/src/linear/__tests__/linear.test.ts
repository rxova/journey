import { describe, expect, it } from "vitest";
import { createLinearJourney } from "@rxova/journey-core";
import { flush, startedLinear } from "../../__tests__/helpers";

describe("createLinearJourney", () => {
  it("accepts string shorthand steps implying empty metadata", async () => {
    const machine = createLinearJourney({
      steps: ["intro", { id: "details", metadata: { label: "Details" } }],
      context: {}
    });
    machine.controls.start();
    await flush();

    expect(machine.getSnapshot().currentStep?.metadata).toEqual({});
    await machine.navigate.goToNextStep();
    expect(machine.getSnapshot().currentStep?.metadata).toEqual({ label: "Details" });
  });

  it("derives order-based snapshot fields", async () => {
    const machine = await startedLinear();
    let snapshot = machine.getSnapshot();
    expect(snapshot.type).toBe("linear");
    expect(snapshot.steps).toEqual({
      totalSteps: 4,
      stepOrder: ["a", "b", "c", "d"],
      visitedStepCount: 1
    });
    expect(snapshot.currentStep).toMatchObject({ index: 0, isFirstStep: true, isLastStep: false });

    await machine.navigate.goToStepById("d");
    snapshot = machine.getSnapshot();
    expect(snapshot.currentStep).toMatchObject({ index: 3, isFirstStep: false, isLastStep: true });
  });

  it("goToNextStep at the tip falls back to the next step in declared order", async () => {
    const machine = await startedLinear();
    expect(await machine.navigate.goToNextStep()).toEqual({ ok: true, from: "a", to: "b" });
    expect(machine.getSnapshot().history.timeline).toEqual(["a", "b"]);
  });

  it("goToStepById is ungated — any declared step is reachable", async () => {
    const machine = await startedLinear();
    expect(await machine.navigate.goToStepById("c")).toEqual({ ok: true, from: "a", to: "c" });
    expect(await machine.navigate.goToStepById("nope" as never)).toEqual({
      ok: false,
      reason: "invalid-target"
    });
  });

  it("rejects empty step lists and duplicate ids at creation", () => {
    expect(() => createLinearJourney({ steps: [], context: {} })).toThrow(/at least one step/);
    expect(() => createLinearJourney({ steps: ["a", { id: "a" }] as const, context: {} })).toThrow(
      /duplicate step id "a"/
    );
  });

  it("snapshots are immutable", async () => {
    const machine = await startedLinear();
    const snapshot = machine.getSnapshot();
    expect(() => {
      (snapshot.history.timeline as string[]).push("x");
    }).toThrow();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.currentStep)).toBe(true);
  });

  it("rebuilds the snapshot per emission — no getters, no staleness", async () => {
    const machine = await startedLinear();
    const before = machine.getSnapshot();
    await machine.navigate.goToNextStep();
    const after = machine.getSnapshot();
    expect(before.currentStep?.id).toBe("a");
    expect(after.currentStep?.id).toBe("b");
    expect(before).not.toBe(after);
  });
});
