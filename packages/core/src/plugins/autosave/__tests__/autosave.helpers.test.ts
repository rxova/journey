import { describe, expect, it } from "vitest";
import { DEFAULT_SAVE_REASONS, normalizeDebounceMs } from "@rxova/journey-core/autosave";

describe("normalizeDebounceMs", () => {
  it("falls back to 300ms for missing or non-finite values", () => {
    expect(normalizeDebounceMs(undefined)).toBe(300);
    expect(normalizeDebounceMs(Number.NaN)).toBe(300);
    expect(normalizeDebounceMs(Number.POSITIVE_INFINITY)).toBe(300);
  });

  it("clamps negatives to zero and truncates fractions", () => {
    expect(normalizeDebounceMs(-5)).toBe(0);
    expect(normalizeDebounceMs(0)).toBe(0);
    expect(normalizeDebounceMs(12.7)).toBe(12);
  });
});

describe("DEFAULT_SAVE_REASONS", () => {
  it("covers every observation kind autosave schedules on", () => {
    expect(DEFAULT_SAVE_REASONS).toEqual(["context", "transition", "status"]);
  });
});
