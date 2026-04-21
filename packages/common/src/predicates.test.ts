import { describe, expect, it } from "vitest";

import { isPlainObject, isPromiseLike, isRecord } from "./predicates";

describe("isRecord", () => {
  it("returns true for plain objects", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it("returns true for arrays (they are objects)", () => {
    expect(isRecord([])).toBe(true);
  });

  it("returns true for class instances", () => {
    expect(isRecord(new Date())).toBe(true);
  });

  it("returns false for null", () => {
    expect(isRecord(null)).toBe(false);
  });

  it("returns false for primitives", () => {
    expect(isRecord("string")).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord(true)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });
});

describe("isPlainObject", () => {
  it("returns true for plain object literals", () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
  });

  it("returns true for null-prototype objects", () => {
    expect(isPlainObject(Object.create(null))).toBe(true);
  });

  it("returns false for arrays", () => {
    expect(isPlainObject([])).toBe(false);
  });

  it("returns false for class instances", () => {
    expect(isPlainObject(new Date())).toBe(false);
    expect(isPlainObject(new Map())).toBe(false);
  });

  it("returns false for null and primitives", () => {
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject("string")).toBe(false);
    expect(isPlainObject(42)).toBe(false);
  });
});

describe("isPromiseLike", () => {
  it("returns true for a native Promise", () => {
    expect(isPromiseLike(Promise.resolve(1))).toBe(true);
  });

  it("returns true for a thenable object", () => {
    expect(isPromiseLike({ then: () => {} })).toBe(true);
  });

  it("returns false for objects without then", () => {
    expect(isPromiseLike({ then: "not-a-function" })).toBe(false);
    expect(isPromiseLike({})).toBe(false);
  });

  it("returns false for primitives and null", () => {
    expect(isPromiseLike(null)).toBe(false);
    expect(isPromiseLike(42)).toBe(false);
    expect(isPromiseLike("string")).toBe(false);
  });
});
