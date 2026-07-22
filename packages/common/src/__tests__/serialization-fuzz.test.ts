import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  cloneForTransport,
  serializeError,
  serializeTransportError
} from "@rxova/journey-common/serialization";

/**
 * Property coverage for the guarantees in the module's TSDoc.
 *
 * Line coverage proves each branch ran on an example someone thought of.
 * "Never throws for any input" and "the result is JSON-stable" are claims about
 * *all* inputs, so they need generated ones — including the shapes nobody
 * writes by hand: cycles, throwing getters, sparse arrays, null prototypes.
 */

const makeThrowingGetter = (): Record<string, unknown> => {
  const value = {};
  Object.defineProperty(value, "boom", {
    get() {
      throw new Error("getter exploded");
    },
    enumerable: true
  });
  return value;
};

const makeThrowingToJson = (): Record<string, unknown> => ({
  toJSON() {
    throw new Error("toJSON exploded");
  }
});

const makeSelfCycle = (): Record<string, unknown> => {
  const value: Record<string, unknown> = { label: "cyclic" };
  value.self = value;
  return value;
};

const makeNullPrototypeBag = (): Record<string, unknown> => {
  // No `toString`, so even the last-resort String() conversion fails.
  const value = Object.create(null) as Record<string, unknown>;
  value.toJSON = () => {
    throw new Error("toJSON exploded");
  };
  return value;
};

/** Values JSON cannot carry, or that actively fight serialization. */
const hostileExtras = fc.oneof(
  fc.constant(undefined),
  fc.constant(Number.NaN),
  fc.constant(Number.POSITIVE_INFINITY),
  fc.constant(Number.NEGATIVE_INFINITY),
  fc.constant(-0),
  fc.constant(/ab+c/gi),
  fc.func(fc.integer()),
  fc.string().map((label) => Symbol(label)),
  fc.string().map((message) => new Error(message)),
  fc.string().map((message) => Object.assign(new Error(message), { cause: { nested: true } })),
  fc.constant(null).map(() => makeThrowingGetter()),
  fc.constant(null).map(() => makeThrowingToJson()),
  fc.constant(null).map(() => makeSelfCycle()),
  fc.constant(null).map(() => makeNullPrototypeBag())
);

const anythingValue = fc.anything({
  withBigInt: true,
  withDate: true,
  withMap: true,
  withSet: true,
  withNullPrototype: true,
  withObjectString: true,
  withSparseArray: true,
  withTypedArray: true
});

const hostileValue = fc.oneof(anythingValue, hostileExtras);

/** Hostile values buried inside ordinary containers, where real data lives. */
const hostileTree = fc.oneof(
  hostileValue,
  fc.array(hostileValue, { maxLength: 6 }),
  fc.dictionary(
    fc.string().filter((key) => key !== "__proto__"),
    hostileValue,
    { maxKeys: 6 }
  ),
  fc.dictionary(
    fc.string().filter((key) => key !== "__proto__"),
    fc.array(hostileValue, { maxLength: 4 }),
    { maxKeys: 4 }
  )
);

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

describe("cloneForTransport properties", () => {
  it("never throws, whatever it is given", () => {
    fc.assert(
      fc.property(hostileTree, (value) => {
        expect(() => cloneForTransport(value)).not.toThrow();
      }),
      { numRuns: 500 }
    );
  });

  it("always produces a JSON-stable result", () => {
    fc.assert(
      fc.property(hostileTree, (value) => {
        const result = cloneForTransport(value);
        // Only a top-level undefined survives as undefined, and JSON cannot
        // represent that; everything else must round-trip byte for byte.
        fc.pre(result !== undefined);
        expect(JSON.parse(JSON.stringify(result)) as unknown).toStrictEqual(result);
      }),
      { numRuns: 500 }
    );
  });

  it("is idempotent — cloning an already-cloned value changes nothing", () => {
    fc.assert(
      fc.property(hostileTree, (value) => {
        const once = cloneForTransport(value);
        expect(cloneForTransport(once)).toStrictEqual(once);
      }),
      { numRuns: 500 }
    );
  });

  it("never drops a key", () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.string().filter((key) => key !== "__proto__"),
          hostileValue,
          { maxKeys: 8 }
        ),
        (value) => {
          const result = cloneForTransport(value);
          // A value that defeats serialization outright degrades to a string;
          // that is the documented fallback, not a dropped key.
          fc.pre(isJsonObject(result));
          expect(Object.keys(result).sort()).toStrictEqual(Object.keys(value).sort());
        }
      ),
      { numRuns: 500 }
    );
  });

  it("never emits undefined inside the result", () => {
    const assertNoUndefined = (value: unknown): void => {
      if (Array.isArray(value)) {
        for (const entry of value) {
          expect(entry).not.toBeUndefined();
          assertNoUndefined(entry);
        }
        return;
      }
      if (isJsonObject(value)) {
        for (const entry of Object.values(value)) {
          expect(entry).not.toBeUndefined();
          assertNoUndefined(entry);
        }
      }
    };

    fc.assert(
      fc.property(hostileTree, (value) => {
        assertNoUndefined(cloneForTransport(value));
      }),
      { numRuns: 500 }
    );
  });
});

describe("error serializer properties", () => {
  it("serializeError never throws and always returns the declared shape", () => {
    fc.assert(
      fc.property(hostileTree, (value) => {
        const result = serializeError(value);
        expect(typeof result.message).toBe("string");
        expect(result.name === null || typeof result.name === "string").toBe(true);
        expect(result.stack === null || typeof result.stack === "string").toBe(true);
        expect(JSON.parse(JSON.stringify(result)) as unknown).toStrictEqual(result);
      }),
      { numRuns: 500 }
    );
  });

  it("serializeTransportError never throws and always returns the declared shape", () => {
    fc.assert(
      fc.property(hostileTree, (value) => {
        const result = serializeTransportError(value);
        expect(typeof result.message).toBe("string");
        expect(result.name === null || typeof result.name === "string").toBe(true);
        expect(result.stack === null || typeof result.stack === "string").toBe(true);
        expect(JSON.parse(JSON.stringify(result)) as unknown).toStrictEqual(result);
      }),
      { numRuns: 500 }
    );
  });
});
