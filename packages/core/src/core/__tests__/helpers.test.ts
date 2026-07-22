import { describe, expect, it } from "vitest";
import { eventWorkKey, shallowEqual } from "@rxova/journey-core/testing";

describe("shallowEqual", () => {
  it("treats flat objects with identical entries as equal", () => {
    expect(shallowEqual({ a: 1, b: "x" }, { a: 1, b: "x" })).toBe(true);
    expect(shallowEqual({}, {})).toBe(true);
  });

  it("ignores key order", () => {
    expect(shallowEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it("reports a changed value", () => {
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it("compares one level only — nested objects go by reference", () => {
    const nested = { deep: true };
    expect(shallowEqual({ nested }, { nested })).toBe(true);
    expect(shallowEqual({ nested: { deep: true } }, { nested: { deep: true } })).toBe(false);
  });

  it("reports differing key counts in both directions", () => {
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(shallowEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  it("reports different key names even when the values line up as undefined", () => {
    // Same key count, and a[\"a\"] and b[\"a\"] are both undefined — comparing
    // values alone would call these equal.
    expect(shallowEqual({ a: undefined }, { b: undefined })).toBe(false);
  });

  it("follows Object.is for NaN and signed zero", () => {
    expect(shallowEqual({ a: NaN }, { a: NaN })).toBe(true);
    expect(shallowEqual({ a: 0 }, { a: -0 })).toBe(false);
  });
});

describe("eventWorkKey", () => {
  it("is injective across step ids that could otherwise collide", () => {
    // Length-prefixing keeps "a" + "bGO" distinct from "ab" + "GO".
    expect(eventWorkKey("a", "bGO")).not.toBe(eventWorkKey("ab", "GO"));
  });

  it("is stable for the same pair", () => {
    expect(eventWorkKey("review", "SUBMIT")).toBe(eventWorkKey("review", "SUBMIT"));
  });
});
