import { describe, expect, it, vi } from "vitest";

import { createJourneyMachineSendController } from "../src/journey-machine/send";
import {
  JourneyDisposedError,
  buildInitialAsyncState,
  buildSendResult,
  buildSnapshot
} from "../src/journey-machine/helpers";

import type { JourneyMachineAsyncStateController } from "../src/journey-machine/async-state";
import type { JourneyMachineNavigationController } from "../src/journey-machine/navigation";
import type { JourneyMachineRuntime } from "../src/journey-machine/runtime";

type StepId = "start" | "review";
type Context = { count: number };
type EventMap = { custom: { amount: number } };

const createSnapshot = (status: "idled" | "running" = "running") =>
  buildSnapshot(
    ["start"],
    0,
    { count: 0 },
    status,
    buildInitialAsyncState({ start: {}, review: {} })
  );

const createRuntime = (snapshot = createSnapshot()) => {
  let current = snapshot;
  const runtime = {
    getSnapshot: vi.fn(() => current),
    peekSnapshot: vi.fn(() => current),
    isDisposed: vi.fn(() => false),
    isRunActive: vi.fn(() => true),
    emit: vi.fn(),
    setSnapshot: vi.fn(),
    cancelInFlight: vi.fn(),
    openLifecycle: vi.fn(),
    closeLifecycle: vi.fn(),
    queue: vi.fn(),
    notify: vi.fn(),
    subscribe: vi.fn(),
    subscribeSelector: vi.fn(),
    subscribeEvent: vi.fn(),
    dispose: vi.fn()
  } as unknown as JourneyMachineRuntime<Context, StepId, EventMap>;
  return {
    runtime,
    setSnapshot: (snapshotValue: typeof snapshot) => {
      current = snapshotValue;
    }
  };
};

const createAsyncState = () =>
  ({
    syncState: vi.fn(),
    setStepIdle: vi.fn(),
    setStepLoading: vi.fn(),
    setStepError: vi.fn()
  }) as unknown as JourneyMachineAsyncStateController<StepId>;

const createNavigation = () =>
  ({
    applyPreviousNavigation: vi.fn(() => buildSendResult(createSnapshot(), true)),
    applyLastVisitedNavigation: vi.fn(() => buildSendResult(createSnapshot(), true)),
    hasDeclaredTransitionForEvent: vi.fn(() => false),
    commitTerminalTransition: vi.fn((_from, to) =>
      buildSendResult(
        buildSnapshot(
          ["start"],
          0,
          { count: 0 },
          to === "COMPLETE" ? "completed" : "terminated",
          buildInitialAsyncState({ start: {}, review: {} })
        ),
        true
      )
    ),
    commitStepTransition: vi.fn(() => buildSendResult(createSnapshot(), true))
  }) as unknown as JourneyMachineNavigationController<
    Context,
    StepId,
    EventMap,
    Record<never, never>
  >;

describe("send controller extra coverage", () => {
  it("includes disposed errors in canceled send results", () => {
    const { runtime } = createRuntime();
    const asyncState = createAsyncState();
    const navigation = createNavigation();
    (runtime.isDisposed as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const controller = createJourneyMachineSendController<
      Context,
      StepId,
      EventMap,
      Record<never, never>
    >(runtime, asyncState, navigation, false, { start: {}, review: {} }, [], {}, false, undefined);

    expect(controller.buildCanceledSendResult("send").error).toBeInstanceOf(JourneyDisposedError);
  });

  it("cancels sends when the machine is not running", async () => {
    const { runtime } = createRuntime(createSnapshot("idled"));
    const asyncState = createAsyncState();
    const navigation = createNavigation();

    const controller = createJourneyMachineSendController<
      Context,
      StepId,
      EventMap,
      Record<never, never>
    >(runtime, asyncState, navigation, false, { start: {}, review: {} }, [], {}, false, undefined);

    const result = await controller.executeSend(
      { type: "goToNextStep" } as never,
      1,
      new AbortController().signal
    );

    expect(result.transitioned).toBe(false);
    expect(navigation.commitTerminalTransition).not.toHaveBeenCalled();
  });

  it("commits direct step transitions for headless goToStepById events and cancels unsupported headless events", async () => {
    const { runtime } = createRuntime();
    const asyncState = createAsyncState();
    const navigation = createNavigation();

    const controller = createJourneyMachineSendController<
      Context,
      StepId,
      EventMap,
      Record<never, never>
    >(runtime, asyncState, navigation, true, { start: {}, review: {} }, [], {}, false, undefined);

    await controller.executeSend(
      { type: "goToStepById", stepId: "review" } as never,
      2,
      new AbortController().signal
    );
    const canceled = await controller.executeSend(
      { type: "custom", payload: { amount: 1 } } as never,
      2,
      new AbortController().signal
    );

    expect(navigation.commitStepTransition).toHaveBeenCalledWith(
      "start",
      "review",
      expect.objectContaining({ type: "goToStepById", stepId: "review" }),
      expect.objectContaining({ event: "goToStepById", to: "review" }),
      { count: 0 },
      2
    );
    expect(canceled.transitioned).toBe(false);
  });

  it("allows terminal navigation events in headless mode", async () => {
    const { runtime } = createRuntime();
    const asyncState = createAsyncState();
    const navigation = createNavigation();

    const controller = createJourneyMachineSendController<
      Context,
      StepId,
      EventMap,
      Record<never, never>
    >(runtime, asyncState, navigation, true, { start: {}, review: {} }, [], {}, false, undefined);

    await controller.executeSend(
      { type: "completeJourney" } as never,
      13,
      new AbortController().signal
    );

    expect(navigation.commitTerminalTransition).toHaveBeenCalledWith(
      "start",
      "COMPLETE",
      expect.objectContaining({ type: "completeJourney" }),
      null,
      { count: 0 },
      13
    );
  });

  it("falls back to previous and terminal navigation when no explicit transition matches", async () => {
    const { runtime } = createRuntime();
    const asyncState = createAsyncState();
    const navigation = createNavigation();

    const controller = createJourneyMachineSendController<
      Context,
      StepId,
      EventMap,
      Record<never, never>
    >(runtime, asyncState, navigation, false, { start: {}, review: {} }, [], {}, false, undefined);

    await controller.executeSend(
      { type: "goToPreviousStep" } as never,
      3,
      new AbortController().signal
    );
    await controller.executeSend(
      { type: "goToNextStep" } as never,
      3,
      new AbortController().signal
    );
    await controller.executeSend(
      { type: "completeJourney" } as never,
      3,
      new AbortController().signal
    );
    await controller.executeSend(
      { type: "terminateJourney" } as never,
      3,
      new AbortController().signal
    );
    const missingGoTo = await controller.executeSend(
      { type: "goToStepById", stepId: "review" } as never,
      3,
      new AbortController().signal
    );

    expect(navigation.applyPreviousNavigation).toHaveBeenCalledWith(1, "goToPreviousStep", 3);
    expect(navigation.commitTerminalTransition).toHaveBeenCalledWith(
      "start",
      "COMPLETE",
      expect.objectContaining({ type: "goToNextStep" }),
      null,
      { count: 0 },
      3
    );
    expect(navigation.commitTerminalTransition).toHaveBeenCalledWith(
      "start",
      "COMPLETE",
      expect.objectContaining({ type: "completeJourney" }),
      null,
      { count: 0 },
      3
    );
    expect(navigation.commitTerminalTransition).toHaveBeenCalledWith(
      "start",
      "TERMINATED",
      expect.objectContaining({ type: "terminateJourney" }),
      null,
      { count: 0 },
      3
    );
    expect(missingGoTo.transitioned).toBe(false);
  });

  it("handles async guard failures without double-reporting step errors", async () => {
    const { runtime } = createRuntime();
    const asyncState = createAsyncState();
    const navigation = createNavigation();
    const controller = createJourneyMachineSendController<
      Context,
      StepId,
      EventMap,
      Record<never, never>
    >(
      runtime,
      asyncState,
      navigation,
      false,
      { start: {}, review: {} },
      [
        {
          id: "guarded",
          from: "start",
          event: "goToNextStep",
          to: "review",
          when: async () => {
            throw new Error("guard boom");
          }
        }
      ] as never,
      {},
      false,
      undefined
    );

    const result = await controller.executeSend(
      { type: "goToNextStep" } as never,
      4,
      new AbortController().signal
    );

    expect(result.transitioned).toBe(false);
    expect((asyncState.setStepError as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    expect(runtime.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "transition.error", eventType: "goToNextStep" })
    );
  });

  it("omits transition ids for async guard failures when the transition has no id", async () => {
    const { runtime } = createRuntime();
    const asyncState = createAsyncState();
    const navigation = createNavigation();
    const controller = createJourneyMachineSendController<
      Context,
      StepId,
      EventMap,
      Record<never, never>
    >(
      runtime,
      asyncState,
      navigation,
      false,
      { start: {}, review: {} },
      [
        {
          from: "start",
          event: "goToNextStep",
          to: "review",
          when: async () => {
            throw new Error("guard boom");
          }
        }
      ] as never,
      {},
      false,
      undefined
    );

    const result = await controller.executeSend(
      { type: "goToNextStep" } as never,
      11,
      new AbortController().signal
    );

    expect(result.transitioned).toBe(false);
    expect(result.transitionId).toBeUndefined();
    expect(asyncState.setStepError).toHaveBeenCalledWith(
      "start",
      "goToNextStep",
      expect.any(Error),
      undefined,
      11
    );
    expect(runtime.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "transition.error", transitionId: null })
    );
  });

  it("returns transition errors when updateContext throws", async () => {
    const { runtime } = createRuntime();
    const asyncState = createAsyncState();
    const navigation = createNavigation();
    const controller = createJourneyMachineSendController<
      Context,
      StepId,
      EventMap,
      Record<never, never>
    >(
      runtime,
      asyncState,
      navigation,
      false,
      { start: {}, review: {} },
      [
        {
          id: "bad-update",
          from: "start",
          event: "goToNextStep",
          to: "review",
          updateContext: () => {
            throw new Error("context boom");
          }
        }
      ] as never,
      {},
      false,
      undefined
    );

    const result = await controller.executeSend(
      { type: "goToNextStep" } as never,
      5,
      new AbortController().signal
    );

    expect(result.transitioned).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect((result.error as Error).message).toContain("context boom");
    expect(asyncState.setStepIdle).toHaveBeenCalledWith("start", 5);
    expect(asyncState.setStepError).toHaveBeenCalledWith(
      "start",
      "goToNextStep",
      expect.any(Error),
      "bad-update",
      5
    );
  });

  it("omits transition ids for updateContext failures when the transition has no id", async () => {
    const { runtime } = createRuntime();
    const asyncState = createAsyncState();
    const navigation = createNavigation();
    const controller = createJourneyMachineSendController<
      Context,
      StepId,
      EventMap,
      Record<never, never>
    >(
      runtime,
      asyncState,
      navigation,
      false,
      { start: {}, review: {} },
      [
        {
          from: "start",
          event: "goToNextStep",
          to: "review",
          updateContext: () => {
            throw new Error("context boom");
          }
        }
      ] as never,
      {},
      false,
      undefined
    );

    const result = await controller.executeSend(
      { type: "goToNextStep" } as never,
      12,
      new AbortController().signal
    );

    expect(result.transitioned).toBe(false);
    expect(result.transitionId).toBeUndefined();
    expect(asyncState.setStepError).toHaveBeenCalledWith(
      "start",
      "goToNextStep",
      expect.any(Error),
      undefined,
      12
    );
  });

  it("cancels goToNextStep when explicit completion is required", async () => {
    const { runtime } = createRuntime();
    const asyncState = createAsyncState();
    const navigation = createNavigation();

    const controller = createJourneyMachineSendController<
      Context,
      StepId,
      EventMap,
      Record<never, never>
    >(runtime, asyncState, navigation, false, { start: {}, review: {} }, [], {}, true, undefined);

    const result = await controller.executeSend(
      { type: "goToNextStep" } as never,
      6,
      new AbortController().signal
    );

    expect(result.transitioned).toBe(false);
    expect(navigation.commitTerminalTransition).not.toHaveBeenCalled();
  });

  it("does not emit transition.success when previous navigation fallback stays put", async () => {
    const { runtime } = createRuntime();
    const asyncState = createAsyncState();
    const navigation = createNavigation();
    (navigation.applyPreviousNavigation as ReturnType<typeof vi.fn>).mockReturnValue(
      buildSendResult(createSnapshot(), false)
    );

    const controller = createJourneyMachineSendController<
      Context,
      StepId,
      EventMap,
      Record<never, never>
    >(runtime, asyncState, navigation, false, { start: {}, review: {} }, [], {}, false, undefined);

    await controller.executeSend(
      { type: "goToPreviousStep" } as never,
      7,
      new AbortController().signal
    );

    expect(runtime.emit).toHaveBeenCalledTimes(1);
    expect(runtime.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "transition.start", from: "start" })
    );
  });

  it("cancels when an async guard failure lands after the run becomes inactive", async () => {
    const { runtime } = createRuntime();
    let active = true;
    (runtime.isRunActive as ReturnType<typeof vi.fn>).mockImplementation(() => active);
    const asyncState = createAsyncState();
    const navigation = createNavigation();
    const controller = createJourneyMachineSendController<
      Context,
      StepId,
      EventMap,
      Record<never, never>
    >(
      runtime,
      asyncState,
      navigation,
      false,
      { start: {}, review: {} },
      [
        {
          id: "late-guard",
          from: "start",
          event: "goToNextStep",
          to: "review",
          when: async () => {
            active = false;
            throw new Error("guard boom");
          }
        }
      ] as never,
      {},
      false,
      undefined
    );

    const result = await controller.executeSend(
      { type: "goToNextStep" } as never,
      8,
      new AbortController().signal
    );

    expect(result.transitioned).toBe(false);
    expect(asyncState.setStepError).toHaveBeenCalledTimes(1);
    expect("error" in result).toBe(false);
  });

  it("cancels when updateContext throws after the run becomes inactive", async () => {
    const { runtime } = createRuntime();
    let active = true;
    (runtime.isRunActive as ReturnType<typeof vi.fn>).mockImplementation(() => active);
    const asyncState = createAsyncState();
    const navigation = createNavigation();
    const controller = createJourneyMachineSendController<
      Context,
      StepId,
      EventMap,
      Record<never, never>
    >(
      runtime,
      asyncState,
      navigation,
      false,
      { start: {}, review: {} },
      [
        {
          id: "late-update",
          from: "start",
          event: "goToNextStep",
          to: "review",
          updateContext: () => {
            active = false;
            throw new Error("context boom");
          }
        }
      ] as never,
      {},
      false,
      undefined
    );

    const result = await controller.executeSend(
      { type: "goToNextStep" } as never,
      9,
      new AbortController().signal
    );

    expect(result.transitioned).toBe(false);
    expect(asyncState.setStepError).not.toHaveBeenCalled();
    expect("error" in result).toBe(false);
  });

  it("cancels after selecting a transition when the run is no longer active", async () => {
    const { runtime } = createRuntime();
    let active = true;
    (runtime.isRunActive as ReturnType<typeof vi.fn>).mockImplementation(() => active);
    const asyncState = createAsyncState();
    const navigation = createNavigation();
    const controller = createJourneyMachineSendController<
      Context,
      StepId,
      EventMap,
      Record<never, never>
    >(
      runtime,
      asyncState,
      navigation,
      false,
      { start: {}, review: {} },
      [
        {
          id: "late-selection",
          from: "start",
          event: "goToNextStep",
          to: "review",
          when: () => {
            active = false;
            return true;
          }
        }
      ] as never,
      {},
      false,
      undefined
    );

    const result = await controller.executeSend(
      { type: "goToNextStep" } as never,
      10,
      new AbortController().signal
    );

    expect(result.transitioned).toBe(false);
    expect(asyncState.setStepIdle).not.toHaveBeenCalled();
  });
});
