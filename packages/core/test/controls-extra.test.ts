import { describe, expect, it, vi } from "vitest";

import { createJourneyMachineControls } from "../src/journey-machine/controls";
import { buildInitialAsyncState, buildSnapshot } from "../src/journey-machine/helpers";

import type { JourneyMachineAsyncStateController } from "../src/journey-machine/async-state";
import type { JourneyMachineRuntime } from "../src/journey-machine/runtime";

type StepId = "start" | "review";
type Context = { count: number };

const createSnapshot = (status: "idled" | "running" = "idled", step: StepId = "start") =>
  buildSnapshot(
    step === "start" ? ["start"] : ["start", "review"],
    step === "start" ? 0 : 1,
    { count: step === "start" ? 0 : 1 },
    status,
    buildInitialAsyncState({ start: {}, review: {} })
  );

const createRuntime = (initialSnapshot = createSnapshot()) => {
  let snapshot = initialSnapshot;
  const runtime = {
    getSnapshot: vi.fn(() => snapshot),
    peekSnapshot: vi.fn(() => snapshot),
    setSnapshot: vi.fn((nextSnapshot) => {
      snapshot = nextSnapshot;
      return nextSnapshot;
    }),
    isDisposed: vi.fn(() => false),
    isRunActive: vi.fn(() => true),
    cancelInFlight: vi.fn(),
    openLifecycle: vi.fn(),
    closeLifecycle: vi.fn(),
    queue: vi.fn(async (runner) => runner(7, new AbortController().signal)),
    notify: vi.fn(),
    emit: vi.fn(),
    subscribe: vi.fn(),
    subscribeSelector: vi.fn(),
    subscribeEvent: vi.fn(),
    dispose: vi.fn()
  } as unknown as JourneyMachineRuntime<Context, StepId, Record<never, never>>;

  return runtime;
};

const createAsyncState = () =>
  ({
    syncState: vi.fn(),
    setStepIdle: vi.fn(),
    setStepLoading: vi.fn(),
    setStepError: vi.fn()
  }) as unknown as JourneyMachineAsyncStateController<StepId>;

describe("controls extra coverage", () => {
  it("returns current snapshots without queueing when disposed", async () => {
    const runtime = createRuntime();
    const asyncState = createAsyncState();
    (runtime.isDisposed as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const controls = createJourneyMachineControls<Context, StepId, Record<never, never>>({
      runtime,
      asyncState,
      initial: "start",
      initialContext: { count: 0 },
      steps: { start: {}, review: {} }
    });

    await expect(controls.startJourney()).resolves.toEqual(runtime.getSnapshot());
    await expect(controls.resetJourney()).resolves.toEqual(runtime.getSnapshot());
    await expect(controls.updateContext((context) => context)).resolves.toEqual(
      runtime.getSnapshot()
    );
    await expect(controls.clearStepError()).resolves.toEqual(runtime.getSnapshot());
    controls.dispose();

    expect(runtime.queue).not.toHaveBeenCalled();
    expect(runtime.dispose).toHaveBeenCalledTimes(1);
  });

  it("starts idled machines and no-ops when already running", async () => {
    const runtime = createRuntime(createSnapshot("idled"));
    const asyncState = createAsyncState();

    const controls = createJourneyMachineControls<Context, StepId, Record<never, never>>({
      runtime,
      asyncState,
      initial: "start",
      initialContext: { count: 0 },
      steps: { start: {}, review: {} }
    });

    const started = await controls.startJourney();

    expect(started.status).toBe("running");
    expect(runtime.setSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ status: "running" }),
      { notify: true, reason: "start" }
    );
    expect(runtime.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "journey.start", stepId: "start" })
    );

    (runtime.peekSnapshot as ReturnType<typeof vi.fn>).mockReturnValue(createSnapshot("running"));
    (runtime.getSnapshot as ReturnType<typeof vi.fn>).mockReturnValue(createSnapshot("running"));

    const alreadyRunning = await controls.startJourney();

    expect(alreadyRunning.status).toBe("running");
  });

  it("resets journey state and clears step errors with explicit or inferred steps", async () => {
    const runtime = createRuntime(createSnapshot("running", "review"));
    const asyncState = createAsyncState();

    const controls = createJourneyMachineControls<Context, StepId, Record<never, never>>({
      runtime,
      asyncState,
      initial: "start",
      initialContext: { count: 0 },
      steps: { start: {}, review: {} }
    });

    const resetSnapshot = await controls.resetJourney();
    expect(resetSnapshot.currentStepId).toBe("start");
    expect(runtime.cancelInFlight).toHaveBeenCalledTimes(1);
    expect(runtime.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "journey.reset", stepId: "start" })
    );
    expect(asyncState.syncState).toHaveBeenCalledWith(resetSnapshot.async);

    await controls.clearStepError();
    await controls.clearStepError("review");
    await controls.clearStepError("missing" as never);

    expect(asyncState.setStepIdle).toHaveBeenNthCalledWith(1, "start");
    expect(asyncState.setStepIdle).toHaveBeenNthCalledWith(2, "review");
  });
});
