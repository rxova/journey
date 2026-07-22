import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cloneForTransport,
  serializeError,
  serializeTransportError
} from "@rxova/journey-common/serialization";

describe("cloneForTransport", () => {
  it("preserves nested Error details", () => {
    const error = Object.assign(new TypeError("nested failure"), { cause: "upstream" });

    expect(cloneForTransport({ error })).toMatchObject({
      error: {
        name: "TypeError",
        message: "nested failure",
        cause: "upstream"
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("labels functions without a name as anonymous", () => {
    const fn = () => undefined;
    Object.defineProperty(fn, "name", { value: "" });
    expect(cloneForTransport({ fn })).toEqual({ fn: "[Function anonymous]" });
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

  it("replaces a cycle that closes through several levels", () => {
    const root: Record<string, unknown> = { name: "root" };
    root.child = { grandchild: { backToRoot: root } };

    const result = cloneForTransport(root) as {
      child: { grandchild: { backToRoot: unknown } };
    };
    expect(result.child.grandchild.backToRoot).toBe("[Circular]");
  });

  it("clones a value referenced twice from sibling keys rather than calling it circular", () => {
    const shared = { id: 1 };

    // A diamond is not a cycle: `b` is perfectly serializable and blanking it
    // out would silently lose data at the far end of the transport.
    expect(cloneForTransport({ a: shared, b: shared })).toEqual({
      a: { id: 1 },
      b: { id: 1 }
    });
  });

  it("clones a value repeated in an array rather than calling it circular", () => {
    const shared = { id: 1 };
    expect(cloneForTransport([shared, shared, shared])).toEqual([{ id: 1 }, { id: 1 }, { id: 1 }]);
  });

  it("clones a value referenced at two different depths", () => {
    const shared = { id: 1 };
    expect(cloneForTransport({ deep: { nested: shared }, shallow: shared })).toEqual({
      deep: { nested: { id: 1 } },
      shallow: { id: 1 }
    });
  });

  it("keeps a nested Error's null stack and absent cause as null", () => {
    const error = new Error("nested stackless");
    delete error.stack;

    expect(cloneForTransport({ error })).toEqual({
      error: { name: "Error", message: "nested stackless", stack: null, cause: null }
    });
  });

  it("normalizes a nested Error's explicitly undefined cause to null", () => {
    // `new Error(msg, { cause: undefined })` installs the property, so the
    // presence check passes and the coalesce is what produces the null.
    const error = Object.assign(new Error("undefined cause"), { cause: undefined });

    expect(cloneForTransport({ error })).toMatchObject({
      error: { message: "undefined cause", cause: null }
    });
  });

  it("replaces an Error that causes itself", () => {
    const error: Error & { cause?: unknown } = new Error("self-caused");
    error.cause = error;

    const result = cloneForTransport({ error }) as { error: { cause: unknown } };
    expect(result.error.cause).toBe("[Circular]");
  });

  it("returns undefined for undefined input", () => {
    expect(cloneForTransport(undefined)).toBe(undefined);
  });

  it("tags a Map so its entries survive", () => {
    expect(cloneForTransport({ m: new Map([["a", 1]]) })).toEqual({
      m: { "[Map]": [["a", 1]] }
    });
  });

  it("tags a Set so its members survive", () => {
    expect(cloneForTransport({ s: new Set([1, 2]) })).toEqual({ s: { "[Set]": [1, 2] } });
  });

  it("tags a typed array with its concrete type", () => {
    expect(cloneForTransport({ bytes: new Uint8Array([1, 2, 3]) })).toEqual({
      bytes: { "[Uint8Array]": [1, 2, 3] }
    });
  });

  it("describes buffers and views without inventing contents", () => {
    expect(cloneForTransport({ buffer: new ArrayBuffer(8) })).toEqual({
      buffer: "[ArrayBuffer byteLength=8]"
    });
    expect(cloneForTransport({ view: new DataView(new ArrayBuffer(4)) })).toEqual({
      view: "[DataView byteLength=4]"
    });
  });

  it("marks a nested undefined instead of dropping the key", () => {
    // The bug this guards: an omitted key makes "explicitly unset" and "never
    // present" indistinguishable to whoever is reading the payload.
    const result = cloneForTransport({ selectedId: undefined }) as Record<string, unknown>;

    expect("selectedId" in result).toBe(true);
    expect(result.selectedId).toBe("[undefined]");
  });

  it("preserves non-finite numbers that JSON would flatten to null", () => {
    expect(cloneForTransport({ a: NaN, b: Infinity, c: -Infinity })).toEqual({
      a: "[NaN]",
      b: "[Infinity]",
      c: "[-Infinity]"
    });
  });

  it("marks array holes rather than reporting them as null", () => {
    expect(cloneForTransport([1, undefined, 3])).toEqual([1, "[undefined]", 3]);
  });

  it("renders a RegExp in its source form", () => {
    expect(cloneForTransport({ pattern: /ab+c/gi })).toEqual({ pattern: "/ab+c/gi" });
  });

  it("identifies values by tag, not prototype, so foreign realms still serialize", () => {
    // `structuredClone` hands back values carrying another realm's prototype:
    // `instanceof ArrayBuffer` is false for this one even though it is a real
    // ArrayBuffer. Values arriving from an iframe, a worker, or an extension
    // port behave the same way, which is exactly this module's input.
    const foreign = structuredClone({ buffer: new ArrayBuffer(8) }).buffer;
    expect(foreign instanceof ArrayBuffer).toBe(false);

    expect(cloneForTransport({ foreign })).toEqual({ foreign: "[ArrayBuffer byteLength=8]" });
  });

  it("detects a cycle that closes through a Map value", () => {
    const root: Record<string, unknown> = {};
    root.entries = new Map<string, unknown>([["back", root]]);

    const result = cloneForTransport(root) as { entries: { "[Map]": [string, unknown][] } };
    expect(result.entries["[Map]"][0]?.[1]).toBe("[Circular]");
  });

  it("falls back to String when an object cannot be cloned or serialized", () => {
    const value = {
      toJSON() {
        throw new Error("cannot serialize");
      },
      toString: () => "fallback value"
    };
    expect(cloneForTransport(value)).toBe("fallback value");
  });

  it("falls back to a placeholder when even String() throws", () => {
    // A null-prototype bag has no `toString`, so the last-resort conversion
    // throws too. The helper still has to return something.
    const value: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    value.toJSON = () => {
      throw new Error("cannot serialize");
    };

    expect(cloneForTransport(value)).toBe("[Unserializable]");
  });

  it("serializes without structuredClone when it is unavailable", () => {
    vi.stubGlobal("structuredClone", undefined);
    expect(cloneForTransport({ value: 1 })).toEqual({ value: 1 });
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

  it("uses a null stack when an Error has no stack", () => {
    const error = new Error("stackless");
    delete error.stack;
    expect(serializeError(error).stack).toBeNull();
  });

  it("serializes a thrown string", () => {
    const result = serializeError("oops");
    expect(result).toEqual({ name: null, message: "oops", stack: null, cause: "oops" });
  });

  it("serializes an unknown non-Error value", () => {
    const result = serializeError(42);
    expect(result).toEqual({ name: null, message: "Unknown error", stack: null, cause: 42 });
  });

  it("keeps cause as an explicit null for a thrown undefined", () => {
    // `cause: undefined` would be dropped by JSON.stringify, leaving consumers
    // with no `cause` property at all rather than a declared empty one.
    const result = serializeError(undefined);

    expect(result.cause).toBeNull();
    expect("cause" in (JSON.parse(JSON.stringify(result)) as object)).toBe(true);
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

  it("uses a null stack when a transport Error has no stack", () => {
    const error = new Error("stackless");
    delete error.stack;
    expect(serializeTransportError(error).stack).toBeNull();
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

  it("normalizes an explicitly undefined record cause", () => {
    expect(serializeTransportError({ message: "failed", cause: undefined }).cause).toBeNull();
  });

  it("sanitizes a record cause so the result can cross another boundary", () => {
    const result = serializeTransportError({
      message: "failed",
      cause: { retry: function retry() {}, size: BigInt(7) }
    });

    expect(result.cause).toEqual({ retry: "[Function retry]", size: "7" });
  });

  it("sanitizes a circular record cause", () => {
    const cause: Record<string, unknown> = { code: 42 };
    cause.self = cause;

    const result = serializeTransportError({ message: "failed", cause });
    expect(result.cause).toEqual({ code: 42, self: "[Circular]" });
    expect(result.cause).not.toBe(cause);
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
