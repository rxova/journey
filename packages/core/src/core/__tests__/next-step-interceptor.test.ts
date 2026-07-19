import { describe, expect, it, vi } from "vitest";
import { startedLinear } from "@rxova/journey-core/testing";

describe("registerNextStepInterceptor", () => {
  it("registered work runs on goToNextStep and its commit stages context atomically", async () => {
    const machine = await startedLinear();
    const seen: { count: number; stepId: string | undefined }[] = [];
    machine.subscriptions.subscribeSelector(
      (snapshot) => snapshot.context as { count: number },
      (context) => {
        seen.push({ count: context.count, stepId: machine.getSnapshot().currentStep?.id });
      }
    );

    machine.navigate.registerNextStepInterceptor("a", {
      run: () => 41,
      commit: ({ result, updateContext }) => {
        updateContext((context) => ({ ...(context as { count: number }), count: result + 1 }));
      }
    });

    expect(await machine.navigate.goToNextStep()).toEqual({ ok: true, from: "a", to: "b" });
    const snapshot = machine.getSnapshot();
    expect(snapshot.context).toEqual({ count: 42 });
    // The context change and the position change land in the same publish.
    expect(seen.find((entry) => entry.count === 42)?.stepId).toBe("b");
  });

  it("a rejected interceptor blocks navigation and surfaces through async state and the error event", async () => {
    const machine = await startedLinear();
    const failure = new Error("save failed");
    const onError = vi.fn();
    machine.subscriptions.subscribeEvent("error", onError);
    machine.navigate.registerNextStepInterceptor("a", {
      run: () => Promise.reject(failure)
    });

    expect(await machine.navigate.goToNextStep()).toEqual({
      ok: false,
      reason: "error",
      error: failure
    });
    const snapshot = machine.getSnapshot();
    expect(snapshot.currentStep?.id).toBe("a");
    expect(snapshot.currentStep?.async.error).toBe(failure);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ error: failure, phase: "work", stepId: "a" })
    );
  });

  it("explicit work passed to goToNextStep overrides the registration", async () => {
    const machine = await startedLinear();
    const registered = vi.fn();
    const explicit = vi.fn();
    machine.navigate.registerNextStepInterceptor("a", { run: registered });

    await machine.navigate.goToNextStep({ run: explicit });
    expect(explicit).toHaveBeenCalledOnce();
    expect(registered).not.toHaveBeenCalled();
  });

  it("only intercepts the step it is registered on", async () => {
    const machine = await startedLinear();
    const work = vi.fn();
    machine.navigate.registerNextStepInterceptor("b", { run: work });

    await machine.navigate.goToNextStep(); // a → b, no interception
    expect(work).not.toHaveBeenCalled();
    await machine.navigate.goToNextStep(); // b → c, intercepted
    expect(work).toHaveBeenCalledOnce();
  });

  it("unregistering stops interception, and a stale unsubscribe never clobbers newer work", async () => {
    const machine = await startedLinear();
    const first = vi.fn();
    const second = vi.fn();

    const unregisterFirst = machine.navigate.registerNextStepInterceptor("a", { run: first });
    unregisterFirst();
    await machine.navigate.goToNextStep();
    expect(first).not.toHaveBeenCalled();
    await machine.navigate.goToPreviousStep();

    const staleUnregister = machine.navigate.registerNextStepInterceptor("a", { run: first });
    machine.navigate.registerNextStepInterceptor("a", { run: second });
    staleUnregister(); // last registration wins; this must be a no-op
    await machine.navigate.goToNextStep();
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });

  it("throws for an unknown step id", async () => {
    const machine = await startedLinear();
    expect(() =>
      machine.navigate.registerNextStepInterceptor("nope" as never, { run: () => undefined })
    ).toThrow(/registerNextStepInterceptor references unknown step "nope"/);
  });
});

describe("registerNextStepInterceptor dev warning", () => {
  it("warns when overwriting a live registration, but not across unregister cycles", async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const machine = await startedLinear();
      const unregister = machine.navigate.registerNextStepInterceptor("a", {
        run: () => undefined
      });
      unregister();
      machine.navigate.registerNextStepInterceptor("a", { run: () => undefined });
      expect(consoleWarn).not.toHaveBeenCalled();

      machine.navigate.registerNextStepInterceptor("a", { run: () => undefined });
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('live registration for step "a"')
      );
    } finally {
      consoleWarn.mockRestore();
      delete (globalThis as { __DEV__?: boolean }).__DEV__;
    }
  });
});
