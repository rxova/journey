import { describe, expect, it, vi } from "vitest";
import { createLinearJourney } from "@rxova/journey-core";
import { flush, wait } from "@rxova/journey-core/testing";

describe("step hooks", () => {
  it("keeps the current step when forward work rejects and exposes the work phase", async () => {
    const boom = new Error("login failed");
    const machine = createLinearJourney({ steps: ["a", "b"], context: {} });
    machine.controls.start();
    await flush();

    const navigation = machine.navigate.goToNextStep({
      run: async () => {
        await wait(20);
        throw boom;
      }
    });
    await wait(5);
    expect(machine.getSnapshot().transition).toMatchObject({
      pending: true,
      phase: "working",
      from: "a",
      to: "b"
    });
    expect(machine.getSnapshot().currentStep?.id).toBe("a");

    expect(await navigation).toEqual({ ok: false, reason: "error", error: boom });
    expect(machine.getSnapshot().currentStep?.id).toBe("a");
    expect(machine.getSnapshot().currentStep?.async.error).toBe(boom);
  });

  it("applies defaultTimeoutMs to navigation work", async () => {
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: {} },
      { defaultTimeoutMs: 10 }
    );
    machine.controls.start();
    await flush();

    const result = await machine.navigate.goToNextStep({ run: () => wait(100) });
    expect(result).toMatchObject({ ok: false, reason: "error" });
    if (!result.ok) expect(String((result.error as Error).message)).toContain("timed out");
    expect(machine.getSnapshot().currentStep?.id).toBe("a");
  });

  it("publishes staged context and forward navigation atomically", async () => {
    const machine = createLinearJourney({ steps: ["a", "b"], context: { password: "secret" } });
    machine.controls.start();
    await flush();
    const snapshots: unknown[] = [];
    machine.subscriptions.subscribeEvent("contextChange", ({ snapshot }) =>
      snapshots.push(snapshot)
    );
    machine.subscriptions.subscribeEvent("stepEnter", ({ snapshot, to }) => {
      if (to === "b") snapshots.push(snapshot);
    });

    expect(
      await machine.navigate.goToNextStep({
        run: ({ direction }) => {
          expect(direction).toBe("forward");
          return { userId: "user-1" };
        },
        commit: ({ result, updateContext }) => {
          updateContext(() => ({ password: "", userId: result.userId }));
        }
      })
    ).toEqual({ ok: true, from: "a", to: "b" });

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]).toBe(snapshots[1]);
    expect(machine.getSnapshot()).toMatchObject({
      context: { password: "", userId: "user-1" },
      currentStep: { id: "b" }
    });
  });

  it("runs the same work contract before backward navigation", async () => {
    const machine = createLinearJourney({ steps: ["a", "b"], context: { saved: false } });
    machine.controls.start();
    await flush();
    await machine.navigate.goToNextStep();

    expect(
      await machine.navigate.goToPreviousStep({
        run: ({ direction, from, to }) => ({ direction, from, to }),
        commit: ({ result, updateContext }) => {
          expect(result).toEqual({ direction: "backward", from: "b", to: "a" });
          updateContext((context) => ({ ...context, saved: true }));
        }
      })
    ).toEqual({ ok: true, from: "b", to: "a" });
    expect(machine.getSnapshot().context.saved).toBe(true);
  });

  it("does not move or publish staged context when commit throws", async () => {
    const boom = new Error("invalid result");
    const machine = createLinearJourney({ steps: ["a", "b"], context: { value: 0 } });
    machine.controls.start();
    await flush();

    expect(
      await machine.navigate.goToNextStep({
        run: () => 1,
        commit: ({ updateContext }) => {
          updateContext(() => ({ value: 1 }));
          throw boom;
        }
      })
    ).toEqual({ ok: false, reason: "error", error: boom });
    expect(machine.getSnapshot()).toMatchObject({
      context: { value: 0 },
      currentStep: { id: "a" }
    });
  });

  it("rejects an asynchronous commit before navigation", async () => {
    const machine = createLinearJourney({ steps: ["a", "b"], context: { value: 0 } });
    machine.controls.start();
    await flush();

    const result = await machine.navigate.goToNextStep({
      run: () => 1,
      commit: (async () => wait(1)) as never
    });

    expect(result).toMatchObject({ ok: false, reason: "error" });
    expect(machine.getSnapshot()).toMatchObject({
      context: { value: 0 },
      currentStep: { id: "a" }
    });
  });

  it("onLeave throwing lets navigation stand and reports a leave effect error", async () => {
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

    const errors: unknown[] = [];
    machine.subscriptions.subscribeEvent("error", (payload) => errors.push(payload));

    expect(await machine.navigate.goToNextStep()).toEqual({ ok: true, from: "a", to: "b" });
    expect(machine.getSnapshot().currentStep?.id).toBe("b");
    expect(errors).toMatchObject([{ error: boom, phase: "leave", stepId: "a" }]);
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

    machine.async.clearError();
    expect(machine.getSnapshot().currentStep?.async).toEqual({
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null
    });

    // Clearing an already-successful or disposed machine is deliberately a no-op.
    machine.async.clearError();
    machine.dispose();
    machine.async.clearError();
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

  it("context updates made inside onLeave are post-commit side effects", async () => {
    const machine = createLinearJourney({
      steps: [
        {
          id: "a",
          onLeave: ({ updateContext }) => {
            updateContext(() => ({ message: "left a" }));
          }
        },
        "b"
      ],
      context: { message: "" }
    });
    machine.controls.start();
    await flush();

    expect(await machine.navigate.goToNextStep()).toEqual({ ok: true, from: "a", to: "b" });
    expect(machine.getSnapshot().context).toEqual({ message: "left a" });
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

  it("defaultTimeoutMs surfaces a slow onLeave without rolling navigation back", async () => {
    const machine = createLinearJourney(
      { steps: [{ id: "a", onLeave: () => wait(200) }, "b"], context: {} },
      { defaultTimeoutMs: 20 }
    );
    machine.controls.start();
    await flush();

    expect(await machine.navigate.goToNextStep()).toEqual({ ok: true, from: "a", to: "b" });
    expect(machine.getSnapshot().currentStep?.id).toBe("b");
    expect(String((machine.getSnapshot().currentStep?.async.error as Error).message)).toContain(
      "timed out"
    );
  });

  it("defaultTimeoutMs preserves a rejected onLeave error as an effect error", async () => {
    const boom = new Error("leave rejected");
    const machine = createLinearJourney(
      { steps: [{ id: "a", onLeave: () => Promise.reject(boom) }, "b"], context: {} },
      { defaultTimeoutMs: 100 }
    );
    machine.controls.start();
    await flush();

    expect(await machine.navigate.goToNextStep()).toEqual({ ok: true, from: "a", to: "b" });
    expect(machine.getSnapshot().currentStep?.async.error).toBe(boom);
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
