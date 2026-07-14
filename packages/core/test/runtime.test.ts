import { describe, expect, it, vi } from "vitest";

import { createJourneyMachineAsyncStateController } from "../src/journey-machine/async-state";
import { buildInitialAsyncState } from "../src/journey-machine/helpers";
import { createJourneyMachineRuntime } from "../src/journey-machine/runtime";

import type { JourneySnapshot } from "@rxova/journey-core";

type StepId = "start" | "review";
type Context = { count: number };
type Snapshot = JourneySnapshot<Context, StepId>;

const createSnapshot = (currentStepId: StepId = "start"): Snapshot => ({
  type: "graph",
  currentStepId,
  history: {
    timeline: currentStepId === "start" ? ["start"] : ["start", "review"],
    index: currentStepId === "start" ? 0 : 1
  },
  context: { count: currentStepId === "start" ? 0 : 1 },
  visited: { start: true, review: currentStepId === "review" },
  status: "running",
  async: buildInitialAsyncState({
    start: {},
    review: {}
  })
});

describe("machine runtime", () => {
  it("keeps later queued work running after an earlier queued action rejects", async () => {
    const runtime = createJourneyMachineRuntime<Context, StepId, never>({
      snapshot: createSnapshot()
    });
    const firstRunner = vi.fn(async () => {
      throw new Error("boom");
    });
    const secondRunner = vi.fn(async () => "ok");

    const first = runtime.queue(firstRunner, () => "first-canceled");
    const second = runtime.queue(secondRunner, () => "second-canceled");

    await expect(first).rejects.toThrow("boom");
    await expect(second).resolves.toBe("ok");
    expect(firstRunner).toHaveBeenCalledTimes(1);
    expect(secondRunner).toHaveBeenCalledTimes(1);
  });

  it("returns a noop selector unsubscribe after dispose", () => {
    const runtime = createJourneyMachineRuntime<Context, StepId, never>({
      snapshot: createSnapshot()
    });
    const listener = vi.fn();

    runtime.dispose();

    const unsubscribe = runtime.subscribeSelector((snapshot) => snapshot.currentStepId, listener);

    expect(() => unsubscribe()).not.toThrow();
    runtime.setSnapshot(createSnapshot("review"), { notify: true });
    expect(listener).not.toHaveBeenCalled();
  });

  it("notifies all subscribers even when one throws", () => {
    const runtime = createJourneyMachineRuntime<Context, StepId, never>({
      snapshot: createSnapshot()
    });

    const listener1 = vi.fn();
    const listener2 = vi.fn(() => {
      throw new Error("listener2 boom");
    });
    const listener3 = vi.fn();

    runtime.subscribe(listener1);
    runtime.subscribe(listener2);
    runtime.subscribe(listener3);

    runtime.setSnapshot(createSnapshot("review"), { notify: true });

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
    expect(listener3).toHaveBeenCalledTimes(1);
  });

  it("emits to all event listeners even when one throws", () => {
    const runtime = createJourneyMachineRuntime<Context, StepId, never>({
      snapshot: createSnapshot()
    });

    const listener1 = vi.fn();
    const listener2 = vi.fn(() => {
      throw new Error("listener2 boom");
    });
    const listener3 = vi.fn();

    runtime.subscribeEvent(listener1);
    runtime.subscribeEvent(listener2);
    runtime.subscribeEvent(listener3);

    const event = { type: "journey.start" as const, stepId: "start" as StepId, timestamp: 1 };
    runtime.emit(event);

    expect(listener1).toHaveBeenCalledWith(event);
    expect(listener2).toHaveBeenCalledWith(event);
    expect(listener3).toHaveBeenCalledWith(event);
  });

  it("isolates a throwing onSnapshotChange: still commits, notifies, and reports the error", () => {
    const initialSnapshot = createSnapshot();
    const nextSnapshot = createSnapshot("review");
    const listener = vi.fn();
    const onListenerError = vi.fn();
    const runtime = createJourneyMachineRuntime<Context, StepId, never>({
      snapshot: initialSnapshot,
      onListenerError,
      onSnapshotChange: () => {
        throw new Error("plugin hook failed");
      }
    });

    runtime.subscribe(listener);

    // A throwing plugin observer must never abort the commit.
    expect(() => runtime.setSnapshot(nextSnapshot, { notify: true })).not.toThrow();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot()).toEqual(nextSnapshot);
    expect(onListenerError).toHaveBeenCalledWith(expect.any(Error), "snapshot");
  });

  it("notifies snapshot and dispose hooks with default runtime reasons", () => {
    const initialSnapshot = createSnapshot();
    const nextSnapshot = createSnapshot("review");
    const onSnapshotChange = vi.fn();
    const onDispose = vi.fn();
    const runtime = createJourneyMachineRuntime<Context, StepId, never>({
      snapshot: initialSnapshot,
      onSnapshotChange,
      onDispose
    });
    const committedInitialSnapshot = runtime.getSnapshot();

    const committedNextSnapshot = runtime.setSnapshot(nextSnapshot);
    runtime.dispose();
    runtime.dispose();

    expect(onSnapshotChange).toHaveBeenCalledWith({
      previousSnapshot: committedInitialSnapshot,
      snapshot: committedNextSnapshot,
      reason: "transition"
    });
    expect(onDispose).toHaveBeenCalledTimes(1);
  });

  it("keeps private and returned snapshots detached from public and hook mutation for plain values", () => {
    type RichContext = {
      nested: { count: number };
      items: string[];
    };
    type RichSnapshot = JourneySnapshot<RichContext, StepId>;

    const createRichSnapshot = (currentStepId: StepId = "start"): RichSnapshot => ({
      type: "graph",
      currentStepId,
      history: {
        timeline: currentStepId === "start" ? ["start"] : ["start", "review"],
        index: currentStepId === "start" ? 0 : 1
      },
      context:
        currentStepId === "start"
          ? { nested: { count: 1 }, items: ["start"] }
          : { nested: { count: 2 }, items: ["review"] },
      visited: { start: true, review: currentStepId === "review" },
      status: "running",
      async: buildInitialAsyncState({
        start: {},
        review: {}
      })
    });

    const runtime = createJourneyMachineRuntime<RichContext, StepId, never>({
      snapshot: createRichSnapshot(),
      onSnapshotChange: ({ snapshot }) => {
        expect(() => {
          (snapshot.context.nested as { count: number }).count = 99;
        }).toThrow();
        expect(() => {
          (snapshot.context.items as string[]).push("hook");
        }).toThrow();
      }
    });

    const leakedSnapshot = runtime.getSnapshot();
    expect(() => {
      (leakedSnapshot.context.nested as { count: number }).count = 42;
    }).toThrow();
    expect(() => {
      (leakedSnapshot.context.items as string[]).push("public");
    }).toThrow();

    expect(runtime.peekSnapshot().context.nested.count).toBe(1);
    expect(runtime.peekSnapshot().context.items).toEqual(["start"]);

    const committedSnapshot = runtime.setSnapshot(createRichSnapshot("review"));

    expect(runtime.peekSnapshot().context.nested.count).toBe(2);
    expect(runtime.peekSnapshot().context.items).toEqual(["review"]);
    expect(committedSnapshot.context.nested.count).toBe(2);
    expect(committedSnapshot.context.items).toEqual(["review"]);
  });

  it("commits async loading state even when the snapshot hook throws", () => {
    const onListenerError = vi.fn();
    const runtime = createJourneyMachineRuntime<Context, StepId, never>({
      snapshot: createSnapshot(),
      onListenerError,
      onSnapshotChange: ({ reason }) => {
        if (reason === "async") {
          throw new Error("async hook failed");
        }
      }
    });
    const asyncState = createJourneyMachineAsyncStateController<Context, StepId, never>({
      runtime
    });

    // The throwing hook is isolated: the commit proceeds and the error is reported.
    expect(() =>
      asyncState.setStepLoading("start", "evaluating-when", "goToNextStep")
    ).not.toThrow();
    expect(onListenerError).toHaveBeenCalledWith(expect.any(Error), "snapshot");
    expect(runtime.getSnapshot().async.isLoading).toBe(true);
    expect(runtime.getSnapshot().async.byStep.start?.phase).toBe("evaluating-when");

    asyncState.setStepIdle("start");
    expect(runtime.getSnapshot().async.isLoading).toBe(false);
    expect(runtime.getSnapshot().async.byStep.start?.phase).toBe("idle");
  });

  it("ignores stale and identical async state updates", () => {
    const runtime = createJourneyMachineRuntime<Context, StepId, never>({
      snapshot: createSnapshot()
    });
    const asyncState = createJourneyMachineAsyncStateController<Context, StepId, never>({
      runtime
    });

    runtime.cancelInFlight();
    asyncState.setStepLoading("start", "evaluating-when", "goToNextStep", undefined, 0);

    expect(runtime.getSnapshot().async.byStep.start?.phase).toBe("idle");

    const before = runtime.getSnapshot();
    asyncState.setStepIdle("start");

    expect(runtime.getSnapshot()).toBe(before);
  });

  it("creates missing async step state entries from the idle fallback", () => {
    const runtime = createJourneyMachineRuntime<Context, StepId, never>({
      snapshot: {
        ...createSnapshot(),
        async: {
          isLoading: false,
          byStep: {} as Snapshot["async"]["byStep"]
        }
      }
    });
    const asyncState = createJourneyMachineAsyncStateController<Context, StepId, never>({
      runtime
    });

    asyncState.setStepLoading("start", "evaluating-when", "goToNextStep");

    expect(runtime.getSnapshot().async.isLoading).toBe(true);
    expect(runtime.getSnapshot().async.byStep.start).toEqual({
      phase: "evaluating-when",
      eventType: "goToNextStep",
      transitionId: null,
      error: null
    });
  });

  it("syncs loading counts and records async step errors", () => {
    const runtime = createJourneyMachineRuntime<Context, StepId, never>({
      snapshot: createSnapshot()
    });
    const asyncState = createJourneyMachineAsyncStateController<Context, StepId, never>({
      runtime
    });

    asyncState.syncState({
      isLoading: true,
      byStep: {
        start: {
          phase: "evaluating-when",
          eventType: "goToNextStep",
          transitionId: "t1",
          error: null
        },
        review: {
          phase: "idle",
          eventType: null,
          transitionId: null,
          error: null
        }
      }
    });
    asyncState.setStepIdle("start");
    asyncState.setStepError("review", "goToNextStep", new Error("boom"), "t2");

    expect(runtime.getSnapshot().async.isLoading).toBe(true);
    expect(runtime.getSnapshot().async.byStep.review).toMatchObject({
      phase: "error",
      eventType: "goToNextStep",
      transitionId: "t2"
    });
    expect((runtime.getSnapshot().async.byStep.review?.error as Error).message).toBe("boom");

    asyncState.setStepError("start", "goToNextStep", new Error("no id"));
    expect(runtime.getSnapshot().async.byStep.start).toMatchObject({
      phase: "error",
      eventType: "goToNextStep",
      transitionId: null
    });
  });
});
