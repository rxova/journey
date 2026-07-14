import { afterEach, describe, expect, it, vi } from "vitest";

import type { JourneyEvent } from "../src/types";
import {
  assertSerializableContext,
  cloneMetaValue,
  JourneyTimeoutError,
  normalizeStepCount,
  selectTransition,
  validateJourneyTransitions,
  warnInDevelopment,
  errorInDevelopment,
  withAbortSignal,
  withTimeout,
  buildInitialAsyncState,
  buildSnapshot,
  transitionSnapshot
} from "../src/journey-machine/helpers";

type TestEventMap = never;
type TestEvent = JourneyEvent<string, TestEventMap>;

describe("helpers extra coverage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("rejects unsupported primitive and circular context values", () => {
    const circular: Record<string, unknown> = { nested: true };
    circular.self = circular;

    expect(() => assertSerializableContext({ bad: new Map() } as never, "Test value")).toThrow(
      /test value\.bad must be JSON-serializable\. Received non-plain map/i
    );
    expect(() => assertSerializableContext({ bad: 1n } as never)).toThrow(/received bigint/i);
    expect(() => assertSerializableContext({ bad: null } as never)).not.toThrow();
    expect(() => assertSerializableContext({ bad: [1, 2] } as never)).not.toThrow();
    expect(() => assertSerializableContext({ nested: { missing: undefined } } as never)).toThrow(
      /nested\.missing must be JSON-serializable\. Received undefined/i
    );
    expect(() => assertSerializableContext({ bad: circular } as never)).toThrow(
      /circular references are not supported/i
    );
  });

  it("falls back when structuredClone is unavailable or throws", () => {
    const source = {
      createdAt: new Date("2026-03-07T08:00:00.000Z"),
      cache: new Map([["count", { value: 1 }]]),
      flags: new Set(["a", "b"])
    };

    vi.stubGlobal("structuredClone", undefined);
    const withoutStructuredClone = cloneMetaValue(source);

    expect(withoutStructuredClone).not.toBe(source);
    expect(withoutStructuredClone.createdAt).not.toBe(source.createdAt);
    expect([...withoutStructuredClone.flags]).toEqual(["a", "b"]);
    expect(withoutStructuredClone.cache.get("count")).toEqual({ value: 1 });

    vi.stubGlobal(
      "structuredClone",
      vi.fn(() => {
        throw new Error("structured clone failed");
      })
    );

    const throwingClone = cloneMetaValue(source);

    expect(throwingClone.createdAt).not.toBe(source.createdAt);
    expect(throwingClone.cache).not.toBe(source.cache);

    const arrayClone = cloneMetaValue([new Date("2026-03-07T08:00:00.000Z"), new Set(["x"])]);
    expect(arrayClone).toHaveLength(2);
    expect(arrayClone[0]).not.toBe(source.createdAt);
  });

  it("normalizes step counts and development diagnostics", () => {
    expect(normalizeStepCount()).toBe(1);
    expect(normalizeStepCount(0)).toBe(1);
    expect(normalizeStepCount(2.8)).toBe(2);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.stubGlobal("__DEV__", true);
    warnInDevelopment("warn message");
    warnInDevelopment("warn with detail", { source: "test" });
    errorInDevelopment("error message");
    errorInDevelopment("error with detail", { source: "test" });

    vi.stubGlobal("__DEV__", false);
    warnInDevelopment("quiet warning");
    errorInDevelopment("quiet error");

    expect(warnSpy).toHaveBeenNthCalledWith(1, "warn message");
    expect(warnSpy).toHaveBeenNthCalledWith(2, "warn with detail", { source: "test" });
    expect(errorSpy).toHaveBeenNthCalledWith(1, "error message");
    expect(errorSpy).toHaveBeenNthCalledWith(2, "error with detail", { source: "test" });
  });

  it("bypasses invalid timeouts and rejects when the timeout expires", async () => {
    vi.useFakeTimers();

    await expect(withTimeout(Promise.resolve("ok"), 0, () => new Error("timeout"))).resolves.toBe(
      "ok"
    );
    await expect(
      withTimeout(Promise.resolve("ok"), undefined, () => new Error("timeout"))
    ).resolves.toBe("ok");

    const pending = withTimeout(
      new Promise<string>(() => undefined),
      25,
      () => new JourneyTimeoutError("timed out")
    );
    const rejection = expect(pending).rejects.toThrow("timed out");

    await vi.advanceTimersByTimeAsync(25);
    await rejection;

    await expect(
      withTimeout(Promise.reject(new Error("runner failed")), 25, () => new Error("timeout"))
    ).rejects.toThrow("runner failed");
  });

  it("covers guard timeout defaults, sync guard errors, and same-step snapshots", async () => {
    vi.useFakeTimers();
    const steps: Record<"a" | "b", unknown> = { a: {}, b: {} };
    const snapshot = buildSnapshot(
      { type: "graph" },
      ["a"],
      0,
      { count: 0 },
      "running",
      buildInitialAsyncState(steps)
    );
    const event: TestEvent = { type: "goToNextStep" };

    const timedOut = selectTransition(
      [
        {
          id: "slow",
          from: "a",
          event: "goToNextStep",
          to: "b",
          when: async () => new Promise<boolean>(() => undefined)
        }
      ],
      snapshot,
      event,
      new AbortController().signal,
      {},
      undefined,
      10
    );
    const timedOutExpectation = expect(timedOut).rejects.toThrow(
      "Transition guard timed out after 10ms"
    );
    await vi.advanceTimersByTimeAsync(10);
    await timedOutExpectation;

    expect(() =>
      transitionSnapshot(snapshot, "a", {
        count: 1
      })
    ).not.toThrow();

    await expect(
      selectTransition(
        [
          {
            from: "a",
            event: "goToNextStep",
            to: "b",
            when: () => {
              throw new Error("sync guard failed");
            }
          }
        ],
        snapshot,
        event,
        new AbortController().signal,
        {}
      )
    ).rejects.toThrow("sync guard failed");
  });

  it("rejects aborted signals for async guards and direct promise waits", async () => {
    const snapshot = buildSnapshot(
      { type: "graph" },
      ["a", "b"],
      0,
      { count: 0 },
      "running",
      buildInitialAsyncState({ a: {}, b: {} })
    );
    const event: TestEvent = { type: "goToNextStep" };
    const controller = new AbortController();

    controller.abort(new Error("aborted"));

    await expect(
      selectTransition(
        [{ from: "a", event: "goToNextStep", to: "b", when: async () => true }],
        snapshot,
        event,
        controller.signal,
        {}
      )
    ).rejects.toThrow("aborted");

    await expect(withAbortSignal(Promise.resolve("ok"), controller.signal)).rejects.toThrow(
      "aborted"
    );
  });

  it("skips mismatches, returns null for blocked guards, and rejects invalid transition hooks", async () => {
    const steps: Record<"a" | "b", unknown> = { a: {}, b: {} };
    const snapshot = buildSnapshot(
      { type: "graph" },
      ["a", "b"],
      0,
      { count: 0 },
      "running",
      buildInitialAsyncState(steps)
    );
    const event: TestEvent = { type: "goToNextStep" };

    const selected = await selectTransition(
      [
        { from: "b", event: "goToNextStep", to: "b" },
        { from: "a", event: "goToPreviousStep", to: "b" } as never,
        { from: "a", event: "goToNextStep", to: "b", when: () => false },
        { id: "match", from: "a", event: "goToNextStep", to: "b" }
      ],
      snapshot,
      event,
      new AbortController().signal,
      {}
    );

    expect(selected?.id).toBe("match");

    const blocked = await selectTransition(
      [{ from: "a", event: "goToNextStep", to: "b", when: () => false }],
      snapshot,
      event,
      new AbortController().signal,
      {}
    );

    expect(blocked).toBeNull();

    expect(() =>
      validateJourneyTransitions(
        [{ from: "a", event: "goToNextStep", to: "b", onEnter: true } as never],
        steps
      )
    ).toThrow(/"onEnter" as a function/i);

    expect(() =>
      validateJourneyTransitions(
        [{ from: "a", event: "goToNextStep", to: "b", extra: true } as never],
        steps
      )
    ).toThrow(/unsupported field "extra"/i);

    expect(() =>
      validateJourneyTransitions(
        [{ from: "a", event: "goToNextStep", to: "b", when: true } as never],
        steps
      )
    ).toThrow(/"when" as a function/i);

    expect(() =>
      validateJourneyTransitions(
        [{ from: "a", event: "goToNextStep", to: "b", onLeave: true } as never],
        steps
      )
    ).toThrow(/"onLeave" as a function/i);

    expect(() =>
      validateJourneyTransitions(
        [{ from: "a", event: "goToNextStep", to: "b", id: 1 } as never],
        steps
      )
    ).toThrow(/"id" as a string/i);

    expect(() =>
      validateJourneyTransitions(
        [{ from: "a", event: "goToNextStep", to: "b", label: 1 } as never],
        steps
      )
    ).toThrow(/"label" as a string/i);

    expect(() =>
      validateJourneyTransitions([{ from: "a", event: "completeJourney", to: "b" } as never], steps)
    ).toThrow(/cannot define "to"/i);

    expect(() =>
      validateJourneyTransitions([{ from: "a", event: "goToNextStep" } as never], steps)
    ).toThrow(/must define string "to"/i);

    expect(() =>
      validateJourneyTransitions(
        [{ from: "a", event: "goToNextStep", to: "missing" as never }] as never,
        steps
      )
    ).toThrow(/points to unknown step "missing"/i);
  });

  it("rejects malformed transition objects before deeper validation", () => {
    const steps: Record<"a" | "b", unknown> = { a: {}, b: {} };

    expect(() => validateJourneyTransitions([null] as never, steps)).toThrow(
      /transition at index 0 must be an object/i
    );
    expect(() =>
      validateJourneyTransitions([{ from: 1, event: "goToNextStep", to: "b" } as never], steps)
    ).toThrow(/must define string "from" and "event"/i);
    expect(() =>
      validateJourneyTransitions(
        [{ from: "missing", event: "goToNextStep", to: "b" } as never],
        steps
      )
    ).toThrow(/references unknown from step "missing"/i);
  });
});
