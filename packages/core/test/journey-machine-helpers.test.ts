import { describe, expect, it, vi } from "vitest";

import type { JourneyEvent } from "../src/types";
import {
  assertSerializableContext,
  buildInitialAsyncState,
  buildSnapshot,
  buildVisitedFromTimeline,
  JourneyTimeoutError,
  selectTransition,
  stabilizeSnapshot,
  transitionSnapshot,
  validateJourneyTransitions,
  withAbortSignal
} from "../src/journey-machine/helpers";

type TestEventMap = never;
type TestEvent = JourneyEvent<string, TestEventMap>;

describe("machine helpers", () => {
  it("buildSnapshot clamps index and resolves current", () => {
    const snapshot = buildSnapshot(
      { type: "graph" },
      ["a", "b", "c"],
      99,
      { count: 1 },
      "running",
      buildInitialAsyncState({ a: {}, b: {}, c: {} })
    );

    expect(snapshot.history.index).toBe(2);
    expect(snapshot.currentStepId).toBe("c");
    expect(snapshot.history.timeline).toEqual(["a", "b", "c"]);
  });

  it("buildVisitedFromTimeline builds visited lookup map", () => {
    expect(buildVisitedFromTimeline(["a", "b", "a", "c", "b"])).toEqual({
      a: true,
      b: true,
      c: true
    });
  });

  it("transitionSnapshot truncates future tail before appending", () => {
    const initial = buildSnapshot(
      { type: "graph" },
      ["a", "b", "c", "d"],
      1,
      { count: 0 },
      "running",
      buildInitialAsyncState({ a: {}, b: {}, c: {}, d: {} }),
      { a: true, b: true, c: true, d: true }
    );

    const next = transitionSnapshot(initial, "d", { count: 2 });

    expect(next.history.timeline).toEqual(["a", "b", "d"]);
    expect(next.history.index).toBe(2);
    expect(next.currentStepId).toBe("d");
    expect(next.context.count).toBe(2);
    expect(next.visited).toEqual({ a: true, b: true, c: true, d: true });
  });

  it("buildSnapshot throws for an empty timeline", () => {
    expect(() =>
      buildSnapshot(
        { type: "graph" },
        [],
        0,
        { count: 0 },
        "running",
        buildInitialAsyncState({ a: {}, b: {} })
      )
    ).toThrow(/timeline cannot be empty/i);
  });

  it("assertSerializableContext rejects non-JSON values", () => {
    expect(() => assertSerializableContext({ when: new Date() } as never)).toThrow(
      /json-serializable/i
    );
    expect(() => assertSerializableContext({ fn: () => "nope" } as never)).toThrow(
      /json-serializable/i
    );
  });

  it("stabilizeSnapshot clones and freezes snapshot branches", () => {
    const source = buildSnapshot(
      { type: "graph" },
      ["a", "b"],
      0,
      {
        nested: {
          count: 1
        }
      },
      "running",
      buildInitialAsyncState({ a: {}, b: {} })
    );

    const snapshot = stabilizeSnapshot(source);

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.context)).toBe(true);
    expect(Object.isFrozen(snapshot.context.nested)).toBe(true);
    expect(snapshot.context).not.toBe(source.context);
  });

  it("selectTransition calls async guard hooks on success and error", async () => {
    const snapshot = buildSnapshot(
      { type: "graph" },
      ["a", "b"],
      0,
      { count: 0 },
      "running",
      buildInitialAsyncState({ a: {}, b: {} })
    );
    const hookEvents: string[] = [];
    const abortController = new AbortController();
    const event: TestEvent = { type: "goToNextStep" };

    const guardOkTransitions = [
      {
        id: "guard-ok",
        label: "guard-ok",
        from: "a",
        event: "goToNextStep",
        to: "b",
        when: async () => true
      }
    ] as const;

    const resolved = await selectTransition(
      guardOkTransitions as never,
      snapshot,
      event,
      abortController.signal,
      {},
      {
        onAsyncGuardStart: (transition) => {
          hookEvents.push(`start:${transition.id}`);
        },
        onAsyncGuardSuccess: (transition) => {
          hookEvents.push(`success:${transition.id}`);
        }
      }
    );

    expect(resolved?.id).toBe("guard-ok");
    expect(hookEvents).toEqual(["start:guard-ok", "success:guard-ok"]);

    const guardFailTransitions = [
      {
        id: "guard-fail",
        label: "guard-fail",
        from: "a",
        event: "goToNextStep",
        to: "b",
        when: async () => {
          throw new Error("boom");
        }
      }
    ] as const;

    await expect(
      selectTransition(
        guardFailTransitions as never,
        snapshot,
        event,
        abortController.signal,
        {},
        {
          onAsyncGuardStart: (transition) => {
            hookEvents.push(`start:${transition.id}`);
          },
          onAsyncGuardError: (transition) => {
            hookEvents.push(`error:${transition.id}`);
          }
        }
      )
    ).rejects.toThrow("boom");

    expect(hookEvents).toContain("start:guard-fail");
    expect(hookEvents).toContain("error:guard-fail");
  });

  it("withAbortSignal rejects when the signal aborts", async () => {
    vi.useFakeTimers();

    try {
      const controller = new AbortController();
      const pending = withAbortSignal(
        new Promise<void>((resolve) => {
          setTimeout(resolve, 100);
        }),
        controller.signal
      );

      controller.abort(new JourneyTimeoutError("aborted"));

      await expect(pending).rejects.toBeInstanceOf(JourneyTimeoutError);
    } finally {
      vi.useRealTimers();
    }
  });

  it("validateJourneyTransitions rejects non-function updateContext values", () => {
    expect(() =>
      validateJourneyTransitions(
        [
          {
            id: "a-to-b",
            from: "a",
            event: "goToNextStep",
            to: "b",
            updateContext: "nope" as never
          }
        ] as never,
        { a: {}, b: {} }
      )
    ).toThrow(/"updateContext" as a function/i);
  });
});
