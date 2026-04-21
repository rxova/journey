import { describe, expect, it } from "vitest";

import { withAbortSignal, withTimeout } from "./async";

describe("withTimeout", () => {
  it("resolves when the promise settles before the timeout", async () => {
    const result = await withTimeout(Promise.resolve(42), 1000, () => new Error("timed out"));
    expect(result).toBe(42);
  });

  it("rejects with the built error when timeout fires first", async () => {
    const slow = new Promise<never>(() => {});
    await expect(withTimeout(slow, 10, () => new Error("timed out"))).rejects.toThrow("timed out");
  });

  it("passes rejection through unchanged", async () => {
    const failing = Promise.reject(new Error("original"));
    await expect(withTimeout(failing, 1000, () => new Error("timed out"))).rejects.toThrow(
      "original"
    );
  });

  it("skips the timeout when timeoutMs is undefined", async () => {
    const result = await withTimeout(
      Promise.resolve("ok"),
      undefined,
      () => new Error("timed out")
    );
    expect(result).toBe("ok");
  });

  it("skips the timeout when timeoutMs is 0", async () => {
    const result = await withTimeout(Promise.resolve("ok"), 0, () => new Error("timed out"));
    expect(result).toBe("ok");
  });

  it("skips the timeout when timeoutMs is negative", async () => {
    const result = await withTimeout(Promise.resolve("ok"), -100, () => new Error("timed out"));
    expect(result).toBe("ok");
  });
});

describe("withAbortSignal", () => {
  it("resolves when the promise settles before abort", async () => {
    const controller = new AbortController();
    const result = await withAbortSignal(Promise.resolve(99), controller.signal);
    expect(result).toBe(99);
  });

  it("rejects immediately when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("pre-aborted"));
    await expect(withAbortSignal(Promise.resolve(1), controller.signal)).rejects.toThrow(
      "pre-aborted"
    );
  });

  it("rejects when abort fires while pending", async () => {
    const controller = new AbortController();
    const slow = new Promise<never>(() => {});
    const result = withAbortSignal(slow, controller.signal);
    controller.abort(new Error("aborted mid-flight"));
    await expect(result).rejects.toThrow("aborted mid-flight");
  });

  it("passes rejection through unchanged", async () => {
    const controller = new AbortController();
    const failing = Promise.reject(new Error("own error"));
    await expect(withAbortSignal(failing, controller.signal)).rejects.toThrow("own error");
  });
});
