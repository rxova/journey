import { describe, expect, it, vi } from "vitest";
import { createLinearJourney } from "@rxova/journey-core";
import { flush, wait } from "@rxova/journey-core/testing";

describe("step hooks", () => {
  it("onLeave returning false cancels navigation (sync and via promise)", async () => {
    let allow = false;
    const machine = createLinearJourney({
      steps: [{ id: "a", onLeave: () => allow }, "b"],
      context: {}
    });
    machine.controls.start();
    await flush();

    const blockedEvents: string[] = [];
    machine.subscriptions.subscribeEvent("navigationBlocked", ({ reason }) =>
      blockedEvents.push(reason)
    );

    expect(await machine.navigate.goToNextStep()).toEqual({ ok: false, reason: "blocked" });
    expect(machine.getSnapshot().currentStep?.id).toBe("a");
    expect(machine.getSnapshot().transition.pending).toBe(false);
    expect(blockedEvents).toEqual(["blocked"]);

    allow = true;
    expect(await machine.navigate.goToNextStep()).toEqual({ ok: true, from: "a", to: "b" });
  });

  it("async onLeave guard blocks until resolved", async () => {
    const machine = createLinearJourney({
      steps: [{ id: "a", onLeave: async () => wait(10).then(() => false) }, "b"],
      context: {}
    });
    machine.controls.start();
    await flush();
    expect(await machine.navigate.goToNextStep()).toEqual({ ok: false, reason: "blocked" });
  });

  it("onLeave throwing cancels with reason error and carries the error", async () => {
    const boom = new Error("no leaving");
    const machine = createLinearJourney({
      steps: [
        {
          id: "a",
          onLeave: () => {
            throw boom;
          }
        },
        "b"
      ],
      context: {}
    });
    machine.controls.start();
    await flush();

    expect(await machine.navigate.goToNextStep()).toEqual({
      ok: false,
      reason: "error",
      error: boom
    });
    expect(machine.getSnapshot().currentStep?.id).toBe("a");
  });

  it("onEnter throwing lets navigation stand, sets async.isError, fires error event", async () => {
    const boom = new Error("enter failed");
    const machine = createLinearJourney({
      steps: [
        "a",
        {
          id: "b",
          onEnter: () => {
            throw boom;
          }
        }
      ],
      context: {}
    });
    machine.controls.start();
    await flush();
    const errors: unknown[] = [];
    machine.subscriptions.subscribeEvent("error", (payload) => errors.push(payload));

    expect(await machine.navigate.goToNextStep()).toEqual({ ok: true, from: "a", to: "b" });
    const step = machine.getSnapshot().currentStep;
    expect(step?.id).toBe("b");
    expect(step?.async).toEqual({ isLoading: false, isSuccess: false, isError: true, error: boom });
    expect(errors).toMatchObject([{ error: boom, phase: "enter", stepId: "b" }]);
  });

  it("exposes loading state and phase while an async onEnter is pending", async () => {
    const machine = createLinearJourney({
      steps: ["a", { id: "b", onEnter: () => wait(20) }],
      context: {}
    });
    machine.controls.start();
    await flush();

    const navigation = machine.navigate.goToNextStep();
    await wait(5);
    let snapshot = machine.getSnapshot();
    expect(snapshot.currentStep?.id).toBe("b");
    expect(snapshot.currentStep?.async.isLoading).toBe(true);
    expect(snapshot.transition).toMatchObject({
      pending: true,
      phase: "entering",
      from: "a",
      to: "b"
    });
    expect(snapshot.machine.isLoading).toBe(true);

    // concurrent navigation during a pending hook chain is rejected, not queued
    expect(await machine.navigate.goToPreviousStep()).toEqual({
      ok: false,
      reason: "transitioning"
    });

    await navigation;
    snapshot = machine.getSnapshot();
    expect(snapshot.currentStep?.async).toEqual({
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null
    });
    expect(snapshot.transition.pending).toBe(false);
  });

  it("context updates made inside a cancelled onLeave stick", async () => {
    const machine = createLinearJourney({
      steps: [
        {
          id: "a",
          onLeave: ({ updateContext }) => {
            updateContext(() => ({ error: "cannot leave yet" }));
            return false;
          }
        },
        "b"
      ],
      context: { error: "" }
    });
    machine.controls.start();
    await flush();

    expect(await machine.navigate.goToNextStep()).toEqual({ ok: false, reason: "blocked" });
    expect(machine.getSnapshot().context).toEqual({ error: "cannot leave yet" });
  });

  it("hooks receive from, to, a null event, and the live snapshot", async () => {
    const seen: unknown[] = [];
    const machine = createLinearJourney({
      steps: [
        {
          id: "a",
          onLeave: ({ from, to, event, snapshot }) => {
            seen.push({ from, to, event, phase: snapshot.transition.phase });
          }
        },
        "b"
      ],
      context: {}
    });
    machine.controls.start();
    await flush();
    await machine.navigate.goToNextStep();

    expect(seen).toEqual([{ from: "a", to: "b", event: null, phase: "leaving" }]);
  });

  it("defaultTimeoutMs treats a slow onLeave as throwing (navigation cancelled)", async () => {
    const machine = createLinearJourney(
      { steps: [{ id: "a", onLeave: () => wait(200) }, "b"], context: {} },
      { defaultTimeoutMs: 20 }
    );
    machine.controls.start();
    await flush();

    const result = await machine.navigate.goToNextStep();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("error");
      expect(String((result.error as Error).message)).toContain("timed out");
    }
    expect(machine.getSnapshot().currentStep?.id).toBe("a");
  });

  it("defaultTimeoutMs preserves a rejected onLeave error", async () => {
    const boom = new Error("leave rejected");
    const machine = createLinearJourney(
      { steps: [{ id: "a", onLeave: () => Promise.reject(boom) }, "b"], context: {} },
      { defaultTimeoutMs: 100 }
    );
    machine.controls.start();
    await flush();

    expect(await machine.navigate.goToNextStep()).toEqual({
      ok: false,
      reason: "error",
      error: boom
    });
  });

  it("defaultTimeoutMs surfaces a slow onEnter as a step error", async () => {
    const machine = createLinearJourney(
      { steps: ["a", { id: "b", onEnter: () => wait(200) }], context: {} },
      { defaultTimeoutMs: 20 }
    );
    machine.controls.start();
    await flush();

    expect(await machine.navigate.goToNextStep()).toEqual({ ok: true, from: "a", to: "b" });
    const step = machine.getSnapshot().currentStep;
    expect(step?.async.isError).toBe(true);
    expect(String((step?.async.error as Error).message)).toContain("timed out");
  });

  it("subscriber exceptions are isolated from the pipeline", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const machine = createLinearJourney({ steps: ["a", "b"], context: {} });
    machine.controls.start();
    await flush();
    machine.subscriptions.subscribeEvent("stepEnter", () => {
      throw new Error("bad listener");
    });
    const seen: string[] = [];
    machine.subscriptions.subscribeEvent("stepEnter", ({ to }) => seen.push(to));

    expect(await machine.navigate.goToNextStep()).toEqual({ ok: true, from: "a", to: "b" });
    expect(seen).toEqual(["b"]);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
