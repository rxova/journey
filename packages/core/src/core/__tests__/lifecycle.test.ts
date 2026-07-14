import { describe, expect, it } from "vitest";
import { createLinearJourney } from "@rxova/journey-core";
import { flush, startedLinear, wait } from "@rxova/journey-core/testing";

describe("lifecycle meta-state-machine", () => {
  it("starts idle with no current step (autoStart defaults to false)", () => {
    const machine = createLinearJourney({ steps: ["a", "b"], context: {} });
    const snapshot = machine.getSnapshot();
    expect(snapshot.status).toBe("idle");
    expect(snapshot.currentStep).toBeNull();
    expect(snapshot.history.currentIndex).toBe(-1);
    expect(snapshot.machine.isIdle).toBe(true);
  });

  it("start() enters the first step and fires stepEnter for pre-attached subscribers", async () => {
    const machine = createLinearJourney({ steps: ["a", "b"], context: {} });
    const entered: (string | null)[][] = [];
    machine.subscriptions.subscribeEvent("stepEnter", ({ from, to }) => entered.push([from, to]));

    expect(machine.controls.start()).toBe(true);
    await flush();

    expect(machine.getSnapshot().status).toBe("running");
    expect(machine.getSnapshot().currentStep?.id).toBe("a");
    expect(machine.getSnapshot().currentStep?.isFirstTimeVisit).toBe(true);
    expect(entered).toEqual([[null, "a"]]);
    expect(machine.controls.start()).toBe(false);
  });

  it("autoStart: true starts inside create", () => {
    const machine = createLinearJourney({ steps: ["a", "b"], context: {} }, { autoStart: true });
    expect(machine.getSnapshot().status).toBe("running");
    expect(machine.getSnapshot().currentStep?.id).toBe("a");
  });

  it("pause blocks navigation; resume restores it", async () => {
    const machine = await startedLinear();
    expect(machine.controls.pause()).toBe(true);
    expect(machine.getSnapshot().machine.isPaused).toBe(true);

    const blocked = await machine.navigate.goToNextStep();
    expect(blocked).toEqual({ ok: false, reason: "not-running" });

    expect(machine.controls.resume()).toBe(true);
    const moved = await machine.navigate.goToNextStep();
    expect(moved).toEqual({ ok: true, from: "a", to: "b" });
  });

  it("complete is explicit only and records an outcome payload", async () => {
    const machine = await startedLinear();
    await machine.navigate.goToStepById("d");

    // goToNextStep on the last step never auto-completes.
    const past = await machine.navigate.goToNextStep();
    expect(past).toEqual({ ok: false, reason: "out-of-bounds" });
    expect(machine.getSnapshot().status).toBe("running");

    expect(machine.controls.complete({ score: 10 })).toBe(true);
    const snapshot = machine.getSnapshot();
    expect(snapshot.status).toBe("completed");
    expect(snapshot.outcome).toEqual({ type: "completed", payload: { score: 10 } });
    expect(snapshot.machine.isCompleted).toBe(true);
  });

  it("complete is rejected while idle or paused", async () => {
    const idle = createLinearJourney({ steps: ["a"], context: {} });
    expect(idle.controls.complete()).toBe(false);

    const machine = await startedLinear();
    machine.controls.pause();
    expect(machine.controls.complete()).toBe(false);
  });

  it("terminate works from any status and wins only once", async () => {
    const idle = createLinearJourney({ steps: ["a"], context: {} });
    expect(idle.controls.terminate("why")).toBe(true);
    expect(idle.getSnapshot().outcome).toEqual({ type: "terminated", payload: "why" });
    expect(idle.controls.terminate()).toBe(false);

    const machine = await startedLinear();
    machine.controls.pause();
    expect(machine.controls.terminate()).toBe(true);
    expect(machine.getSnapshot().status).toBe("terminated");
  });

  it("restart resets timeline, context, visits, and outcome", async () => {
    const machine = createLinearJourney({ steps: ["a", "b"], context: { n: 1 } });
    machine.controls.start();
    await flush();
    machine.context.update((prev) => ({ n: prev.n + 41 }));
    await machine.navigate.goToNextStep();
    machine.controls.complete();

    expect(machine.controls.restart()).toBe(true);
    await flush();
    const snapshot = machine.getSnapshot();
    expect(snapshot.status).toBe("running");
    expect(snapshot.context).toEqual({ n: 1 });
    expect(snapshot.outcome).toBeNull();
    expect(snapshot.history.timeline).toEqual(["a"]);
    expect(snapshot.currentStep?.isFirstTimeVisit).toBe(true);
    expect(snapshot.steps.visitedStepCount).toBe(1);
  });

  it("restart is rejected while running or idle", async () => {
    const idle = createLinearJourney({ steps: ["a"], context: {} });
    expect(idle.controls.restart()).toBe(false);
    const machine = await startedLinear();
    expect(machine.controls.restart()).toBe(false);
  });

  it("lifecycle verbs (except terminate) are rejected during a pending transition", async () => {
    const machine = createLinearJourney({
      steps: [{ id: "a", onLeave: () => wait(30) }, "b"],
      context: {}
    });
    machine.controls.start();
    await flush();

    const navigation = machine.navigate.goToNextStep();
    expect(machine.getSnapshot().transition.pending).toBe(true);
    expect(machine.controls.pause()).toBe(false);
    expect(machine.controls.complete()).toBe(false);
    await navigation;
    expect(machine.getSnapshot().currentStep?.id).toBe("b");
  });

  it("terminate during a pending transition wins; the in-flight promise resolves not-running", async () => {
    const machine = createLinearJourney({
      steps: [{ id: "a", onLeave: () => wait(30) }, "b"],
      context: {}
    });
    machine.controls.start();
    await flush();

    const navigation = machine.navigate.goToNextStep();
    expect(machine.controls.terminate()).toBe(true);
    expect(await navigation).toEqual({ ok: false, reason: "not-running" });
    expect(machine.getSnapshot().status).toBe("terminated");
    expect(machine.getSnapshot().currentStep?.id).toBe("a");
  });

  it("dispose is irreversible and makes every method a safe no-op", async () => {
    const machine = await startedLinear();
    machine.dispose();
    machine.dispose();

    expect(machine.controls.start()).toBe(false);
    expect(machine.controls.terminate()).toBe(false);
    expect(await machine.navigate.goToNextStep()).toEqual({ ok: false, reason: "disposed" });
    expect(() => machine.context.update((c) => c)).not.toThrow();
  });
});
