import { describe, expect, it } from "vitest";
import {
  normalizeMaxEntries,
  serializeReplaySession,
  toSerializable
} from "@rxova/journey-core/replay";

describe("normalizeMaxEntries", () => {
  it("defaults non-finite values and clamps to at least one entry", () => {
    expect(normalizeMaxEntries(undefined)).toBe(500);
    expect(normalizeMaxEntries(Number.NaN)).toBe(500);
    expect(normalizeMaxEntries(Number.POSITIVE_INFINITY)).toBe(500);
    expect(normalizeMaxEntries(0)).toBe(1);
    expect(normalizeMaxEntries(-3)).toBe(1);
    expect(normalizeMaxEntries(7.9)).toBe(7);
  });
});

describe("toSerializable", () => {
  it("passes JSON-safe values through unchanged", () => {
    expect(toSerializable(null)).toBeNull();
    expect(toSerializable("x")).toBe("x");
    expect(toSerializable(3)).toBe(3);
    expect(toSerializable(true)).toBe(true);
    expect(toSerializable([1, "a"])).toEqual([1, "a"]);
    expect(toSerializable({ a: { b: 1 } })).toEqual({ a: { b: 1 } });
  });

  it("converts exotic values into transport-safe stand-ins", () => {
    expect(toSerializable(10n)).toBe("10");
    expect(toSerializable(undefined)).toBeNull();
    expect(toSerializable(() => 1)).toBe("[unsupported:function]");
    expect(toSerializable(Symbol("s"))).toBe("[unsupported:symbol]");
    expect(toSerializable(new Date(0))).toBe("1970-01-01T00:00:00.000Z");
    const error = new Error("boom");
    expect(toSerializable(error)).toMatchObject({ name: "Error", message: "boom" });
  });

  it("marks circular references instead of recursing forever", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(toSerializable(circular)).toEqual({ self: "[circular]" });
    // the same object twice in different branches is not circular
    const shared = { v: 1 };
    expect(toSerializable({ a: shared, b: shared })).toEqual({ a: { v: 1 }, b: { v: 1 } });
  });
});

describe("serializeReplaySession", () => {
  it("honours the pretty option", () => {
    const session = { startedAt: 1, entries: [] };
    expect(serializeReplaySession(session)).toBe('{"startedAt":1,"entries":[]}');
    expect(serializeReplaySession(session, { pretty: true })).toContain("\n");
  });
});
