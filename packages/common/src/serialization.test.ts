import { describe, expect, it } from "vitest";

import { cloneForTransport, serializeError, serializeTransportError } from "./serialization";

describe("cloneForTransport", () => {
  it("passes through primitives", () => {
    expect(cloneForTransport(42)).toBe(42);
    expect(cloneForTransport("hello")).toBe("hello");
    expect(cloneForTransport(null)).toBe(null);
    expect(cloneForTransport(true)).toBe(true);
  });

  it("deep-clones plain objects", () => {
    const obj = { a: 1, b: { c: 2 } };
    const result = cloneForTransport(obj);
    expect(result).toEqual(obj);
    expect(result).not.toBe(obj);
  });

  it("serializes bigints as strings", () => {
    expect(cloneForTransport({ n: BigInt(42) })).toEqual({ n: "42" });
  });

  it("serializes functions as a description string", () => {
    const result = cloneForTransport({ fn: function myFn() {} }) as { fn: string };
    expect(result.fn).toBe("[Function myFn]");
  });

  it("serializes functions using their inferred name", () => {
    const result = cloneForTransport({ fn: () => {} }) as { fn: string };
    expect(result.fn).toBe("[Function fn]");
  });

  it("serializes symbols as strings", () => {
    const result = cloneForTransport({ s: Symbol("test") }) as { s: string };
    expect(result.s).toBe("Symbol(test)");
  });

  it("replaces circular references with [Circular]", () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    const result = cloneForTransport(obj) as Record<string, unknown>;
    expect(result.a).toBe(1);
    expect(result.self).toBe("[Circular]");
  });

  it("returns undefined for undefined input", () => {
    expect(cloneForTransport(undefined)).toBe(undefined);
  });
});

describe("serializeError", () => {
  it("serializes an Error instance", () => {
    const error = new Error("something broke");
    const result = serializeError(error);
    expect(result.name).toBe("Error");
    expect(result.message).toBe("something broke");
    expect(typeof result.stack).toBe("string");
    expect(result.cause).toBe(null);
  });

  it("includes cause from Error when present", () => {
    const cause = { reason: "downstream failure" };
    const error = Object.assign(new Error("outer"), { cause });
    const result = serializeError(error);
    expect(result.cause).toEqual(cause);
  });

  it("serializes a thrown string", () => {
    const result = serializeError("oops");
    expect(result).toEqual({ name: null, message: "oops", stack: null, cause: "oops" });
  });

  it("serializes an unknown non-Error value", () => {
    const result = serializeError(42);
    expect(result).toEqual({ name: null, message: "Unknown error", stack: null, cause: 42 });
  });

  it("wraps plain-object throws as cause", () => {
    const obj = { reason: "object failure" };
    const result = serializeError(obj);
    expect(result.name).toBe(null);
    expect(result.cause).toEqual(obj);
  });
});

describe("serializeTransportError", () => {
  it("serializes an Error instance", () => {
    const error = new Error("transport failed");
    const result = serializeTransportError(error);
    expect(result.name).toBe("Error");
    expect(result.message).toBe("transport failed");
    expect(result.cause).toBe(null);
  });

  it("extracts fields from a record", () => {
    const record = { name: "CustomError", message: "bad message", stack: "at foo:1", cause: "x" };
    const result = serializeTransportError(record);
    expect(result).toEqual({
      name: "CustomError",
      message: "bad message",
      stack: "at foo:1",
      cause: "x"
    });
  });

  it("falls back to Unknown transport error for records without message", () => {
    const result = serializeTransportError({ code: 42 });
    expect(result.message).toBe("Unknown transport error");
    expect(result.name).toBe(null);
  });

  it("serializes a thrown string", () => {
    const result = serializeTransportError("net error");
    expect(result).toEqual({ name: null, message: "net error", stack: null, cause: null });
  });

  it("falls back for unknown non-Error non-record value", () => {
    const result = serializeTransportError(undefined);
    expect(result).toEqual({
      name: null,
      message: "Unknown transport error",
      stack: null,
      cause: null
    });
  });
});
