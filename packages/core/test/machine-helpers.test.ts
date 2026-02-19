import { describe, expect, it } from "vitest";

import {
  buildInitialAsyncState,
  buildSnapshot,
  buildVisitedFromTimeline,
  selectTransition,
  transitionSnapshot
} from "../src/machine-helpers";

describe("machine helpers", () => {
  it("buildSnapshot clamps index and resolves current", () => {
    const snapshot = buildSnapshot(
      ["a", "b", "c"],
      99,
      { count: 1 },
      "running",
      buildInitialAsyncState({ a: {}, b: {}, c: {} }),
      { a: undefined, b: undefined, c: undefined }
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
      ["a", "b", "c", "d"],
      1,
      { count: 0 },
      "running",
      buildInitialAsyncState({ a: {}, b: {}, c: {}, d: {} }),
      { a: undefined, b: undefined, c: undefined, d: undefined },
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
      buildSnapshot([], 0, { count: 0 }, "running", buildInitialAsyncState({ a: {}, b: {} }), {
        a: undefined,
        b: undefined
      })
    ).toThrow(/timeline cannot be empty/i);
  });

  it("selectTransition calls async guard hooks on success and error", async () => {
    const snapshot = buildSnapshot(
      ["a", "b"],
      0,
      { count: 0 },
      "running",
      buildInitialAsyncState({ a: {}, b: {} }),
      { a: undefined, b: undefined }
    );
    const hookEvents: string[] = [];

    const resolved = await selectTransition(
      [
        {
          id: "guard-ok",
          from: "a",
          event: "goToNextStep",
          to: "b",
          when: async () => true
        }
      ],
      snapshot,
      { type: "goToNextStep" },
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

    await expect(
      selectTransition(
        [
          {
            id: "guard-fail",
            from: "a",
            event: "goToNextStep",
            to: "b",
            when: async () => {
              throw new Error("boom");
            }
          }
        ],
        snapshot,
        { type: "goToNextStep" },
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
});
