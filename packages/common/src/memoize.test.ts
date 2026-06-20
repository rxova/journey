import { describe, expect, it, vi } from "vitest";

import { memoizeByIdentity } from "./memoize";

describe("memoizeByIdentity", () => {
  it("computes on the first call and returns that result", () => {
    const fn = vi.fn((value: { n: number }) => value.n * 2);
    const memoized = memoizeByIdentity(fn);
    const arg = { n: 21 };

    expect(memoized(arg)).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("returns the cached result without recomputing for the same argument identity", () => {
    const fn = vi.fn((value: { n: number }) => ({ doubled: value.n * 2 }));
    const memoized = memoizeByIdentity(fn);
    const arg = { n: 5 };

    const first = memoized(arg);
    const second = memoized(arg);

    expect(second).toBe(first);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("recomputes when the argument identity changes", () => {
    const fn = vi.fn((value: { n: number }) => value.n * 2);
    const memoized = memoizeByIdentity(fn);

    expect(memoized({ n: 1 })).toBe(2);
    expect(memoized({ n: 2 })).toBe(4);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("only caches the most recent argument", () => {
    const fn = vi.fn((value: { n: number }) => value.n * 2);
    const memoized = memoizeByIdentity(fn);
    const a = { n: 1 };
    const b = { n: 2 };

    memoized(a);
    memoized(b);
    memoized(a); // identity matches `a` but `b` evicted it

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("caches falsy results (null/undefined/0) without recomputing", () => {
    const fn = vi.fn(() => null);
    const memoized = memoizeByIdentity(fn);
    const arg = { id: "x" };

    expect(memoized(arg)).toBeNull();
    expect(memoized(arg)).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("treats primitive arguments by value identity", () => {
    const fn = vi.fn((value: number) => value + 1);
    const memoized = memoizeByIdentity(fn);

    expect(memoized(1)).toBe(2);
    expect(memoized(1)).toBe(2);
    expect(fn).toHaveBeenCalledTimes(1);

    expect(memoized(2)).toBe(3);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("keeps independent caches per memoized instance", () => {
    const fn = vi.fn((value: { n: number }) => value.n);
    const first = memoizeByIdentity(fn);
    const second = memoizeByIdentity(fn);
    const arg = { n: 7 };

    first(arg);
    second(arg);

    expect(fn).toHaveBeenCalledTimes(2);
  });
});
