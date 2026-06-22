import { afterEach, describe, expect, it, vi } from "vitest";

import { createJourneyMachineRuntime } from "../src/journey-machine/runtime";
import { buildInitialAsyncState } from "../src/journey-machine/helpers";

import type { JourneySnapshot } from "@rxova/journey-core";

type StepId = "start" | "review";
type Context = { count: number };
type Snapshot = JourneySnapshot<Context, StepId>;

const createSnapshot = (currentStepId: StepId = "start"): Snapshot => ({
  currentStepId,
  history: {
    timeline: currentStepId === "start" ? ["start"] : ["start", "review"],
    index: currentStepId === "start" ? 0 : 1
  },
  context: { count: currentStepId === "start" ? 0 : 1 },
  visited: { start: true, review: currentStepId === "review" },
  status: "running",
  async: buildInitialAsyncState({ start: {}, review: {} })
});

describe("runtime extra coverage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the canceled result for queued work invalidated before it runs", async () => {
    const runtime = createJourneyMachineRuntime<Context, StepId, never>({
      snapshot: createSnapshot()
    });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const secondRunner = vi.fn(async () => "ok");

    const first = runtime.queue(
      async () => {
        await gate;
        return "first";
      },
      () => "first-canceled"
    );
    const second = runtime.queue(secondRunner, () => "second-canceled");

    runtime.cancelInFlight();
    release();

    await expect(first).resolves.toBe("first-canceled");
    await expect(second).resolves.toBe("second-canceled");
    expect(secondRunner).not.toHaveBeenCalled();
  });

  it("returns noop unsubscribers for snapshot and event listeners after dispose", () => {
    const runtime = createJourneyMachineRuntime<Context, StepId, never>({
      snapshot: createSnapshot()
    });
    const snapshotListener = vi.fn();
    const eventListener = vi.fn();

    runtime.dispose();

    const unsubscribeSnapshot = runtime.subscribe(snapshotListener);
    const unsubscribeEvent = runtime.subscribeEvent(eventListener);

    expect(() => unsubscribeSnapshot()).not.toThrow();
    expect(() => unsubscribeEvent()).not.toThrow();

    runtime.setSnapshot(createSnapshot("review"), { notify: true });
    runtime.emit({ type: "journey.start", stepId: "start", timestamp: 1 });

    expect(snapshotListener).not.toHaveBeenCalled();
    expect(eventListener).not.toHaveBeenCalled();
  });

  it("opens lifecycle controllers only for active run versions", () => {
    const runtime = createJourneyMachineRuntime<Context, StepId, never>({
      snapshot: createSnapshot()
    });

    const activeController = runtime.openLifecycle(0);

    expect(activeController).toBeInstanceOf(AbortController);

    runtime.cancelInFlight();

    expect(runtime.openLifecycle(0)).toBeNull();

    runtime.closeLifecycle(activeController as AbortController);
  });

  it("aborts the active queued runner when work is canceled mid-flight", async () => {
    const runtime = createJourneyMachineRuntime<Context, StepId, never>({
      snapshot: createSnapshot()
    });
    let signalRef: AbortSignal | null = null;

    const result = runtime.queue(
      async (_runVersion, signal) => {
        signalRef = signal;
        await new Promise<void>((resolve) => {
          signal.addEventListener("abort", () => resolve(), { once: true });
        });
        return "aborted";
      },
      () => "canceled"
    );

    await Promise.resolve();
    const activeSignal = signalRef as unknown as { aborted: boolean } | null;
    expect(activeSignal).not.toBeNull();
    if (activeSignal === null) {
      throw new Error("Expected the queued runner to capture an abort signal.");
    }
    expect(activeSignal.aborted).toBe(false);

    runtime.cancelInFlight();

    expect(activeSignal.aborted).toBe(true);
    await expect(result).resolves.toBe("aborted");
  });

  it("aborts newly created controllers when the run becomes inactive during setup", async () => {
    const OriginalAbortController = AbortController;

    const lifecycleRuntime = createJourneyMachineRuntime<Context, StepId, never>({
      snapshot: createSnapshot()
    });
    let cancelLifecycleOnConstruct = true;
    vi.stubGlobal(
      "AbortController",
      class extends OriginalAbortController {
        constructor() {
          super();
          if (cancelLifecycleOnConstruct) {
            cancelLifecycleOnConstruct = false;
            lifecycleRuntime.cancelInFlight();
          }
        }
      }
    );

    expect(lifecycleRuntime.openLifecycle(0)).toBeNull();

    const queueRuntime = createJourneyMachineRuntime<Context, StepId, never>({
      snapshot: createSnapshot()
    });
    let cancelQueueOnConstruct = true;
    vi.stubGlobal(
      "AbortController",
      class extends OriginalAbortController {
        constructor() {
          super();
          if (cancelQueueOnConstruct) {
            cancelQueueOnConstruct = false;
            queueRuntime.cancelInFlight();
          }
        }
      }
    );

    const runner = vi.fn(async () => "ok");
    const queued = queueRuntime.queue(runner, () => "canceled");

    await expect(queued).resolves.toBe("canceled");
    expect(runner).not.toHaveBeenCalled();
  });

  it("skips re-aborting lifecycle controllers that were already aborted", () => {
    const runtime = createJourneyMachineRuntime<Context, StepId, never>({
      snapshot: createSnapshot()
    });
    const controller = runtime.openLifecycle(0);

    expect(controller).toBeInstanceOf(AbortController);
    controller?.abort();

    expect(() => runtime.cancelInFlight()).not.toThrow();
  });
});
