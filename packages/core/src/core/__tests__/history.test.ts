import { describe, expect, it, vi } from "vitest";
import { createLinearJourney } from "@rxova/journey-core";
import { flush, startedLinear } from "@rxova/journey-core/testing";

describe("timeline history (browser model)", () => {
  it("forward navigation appends to the timeline", async () => {
    const machine = await startedLinear();
    await machine.navigate.goToNextStep();
    await machine.navigate.goToNextStep();

    const { history } = machine.getSnapshot();
    expect(history.timeline).toEqual(["a", "b", "c"]);
    expect(history.currentIndex).toBe(2);
    expect(history.canGoBack).toBe(true);
    expect(history.canGoForward).toBe(false);
  });

  it("goToPreviousStep moves the pointer without truncating", async () => {
    const machine = await startedLinear();
    await machine.navigate.goToNextStep();
    await machine.navigate.goToNextStep();
    const back = await machine.navigate.goToPreviousStep();

    expect(back).toEqual({ ok: true, from: "c", to: "b" });
    const { history } = machine.getSnapshot();
    expect(history.timeline).toEqual(["a", "b", "c"]);
    expect(history.currentIndex).toBe(1);
    expect(history.canGoForward).toBe(true);
  });

  it("goToNextStep with a forward entry walks the timeline, not the declared order", async () => {
    const machine = await startedLinear();
    await machine.navigate.goToStepById("d");
    await machine.navigate.goToPreviousStep();
    expect(machine.getSnapshot().currentStep?.id).toBe("a");

    const forward = await machine.navigate.goToNextStep();
    expect(forward).toEqual({ ok: true, from: "a", to: "d" });
  });

  it("navigating somewhere new while back in the timeline truncates forward entries", async () => {
    const machine = await startedLinear();
    await machine.navigate.goToNextStep(); // a b
    await machine.navigate.goToNextStep(); // a b c
    await machine.navigate.goToPreviousStep(2); // pointer at a
    await machine.navigate.goToStepById("d");

    const { history } = machine.getSnapshot();
    expect(history.timeline).toEqual(["a", "d"]);
    expect(history.currentIndex).toBe(1);
    expect(history.canGoForward).toBe(false);
  });

  it("multi-entry jumps fire hooks once — leave current, enter target", async () => {
    const hooks = {
      aEnter: vi.fn(),
      bEnter: vi.fn(),
      bLeave: vi.fn(),
      cLeave: vi.fn()
    };
    const machine = createLinearJourney({
      steps: [
        { id: "a", onEnter: hooks.aEnter },
        { id: "b", onEnter: hooks.bEnter, onLeave: hooks.bLeave },
        { id: "c", onLeave: hooks.cLeave }
      ],
      context: {}
    });
    machine.controls.start();
    await flush();
    await machine.navigate.goToNextStep();
    await machine.navigate.goToNextStep();
    hooks.aEnter.mockClear();
    hooks.bEnter.mockClear();
    hooks.bLeave.mockClear();

    await machine.navigate.goToPreviousStep(2);

    expect(hooks.cLeave).toHaveBeenCalledTimes(1);
    expect(hooks.aEnter).toHaveBeenCalledTimes(1);
    expect(hooks.bEnter).not.toHaveBeenCalled();
    expect(hooks.bLeave).not.toHaveBeenCalled();
  });

  it("goToPreviousStep clamps to the start and fails only at index 0", async () => {
    const machine = await startedLinear();
    await machine.navigate.goToNextStep();
    const clamped = await machine.navigate.goToPreviousStep(99);
    expect(clamped).toEqual({ ok: true, from: "b", to: "a" });

    const atStart = await machine.navigate.goToPreviousStep();
    expect(atStart).toMatchObject({ ok: false, reason: "out-of-bounds" });
  });

  it("goToLastVisitedStep jumps the pointer to the tip; fails if already there", async () => {
    const machine = await startedLinear();
    await machine.navigate.goToNextStep();
    await machine.navigate.goToNextStep();
    await machine.navigate.goToPreviousStep(2);

    const jump = await machine.navigate.goToLastVisitedStep();
    expect(jump).toEqual({ ok: true, from: "a", to: "c" });
    expect(machine.getSnapshot().history.currentIndex).toBe(2);

    const again = await machine.navigate.goToLastVisitedStep();
    expect(again).toMatchObject({ ok: false, reason: "no-op" });
  });

  it("navigating to the current step is a no-op", async () => {
    const machine = await startedLinear();
    expect(await machine.navigate.goToStepById("a")).toMatchObject({ ok: false, reason: "no-op" });
  });

  it("tracks visited steps and first-time visits across revisits", async () => {
    const machine = await startedLinear();
    await machine.navigate.goToNextStep();
    expect(machine.getSnapshot().currentStep?.isFirstTimeVisit).toBe(true);

    await machine.navigate.goToPreviousStep();
    const snapshot = machine.getSnapshot();
    expect(snapshot.currentStep?.id).toBe("a");
    expect(snapshot.currentStep?.isFirstTimeVisit).toBe(false);
    expect(snapshot.history.visited).toEqual({ a: true, b: true, c: false, d: false });
    expect(snapshot.steps.visitedStepCount).toBe(2);
  });
});
