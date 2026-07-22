/**
 * Turning arbitrary runtime values into something safe to send across a
 * process boundary — a `postMessage` to a devtools panel, a `chrome.runtime`
 * message, a log sink.
 *
 * The hard requirement is *never throw*. These helpers run on the error path,
 * where the caller is already handling a failure; a serializer that throws
 * turns a recoverable problem into a lost one. Every function here degrades to
 * a lossy-but-valid result rather than propagating.
 */

import { isRecord } from "./predicates";

/**
 * A transport-safe description of a thrown value. Every field is either a
 * primitive or already cloned, so the whole object survives `postMessage` and
 * `JSON.stringify` without further processing.
 */
export type SerializedError = {
  /** The error's `name`, or `null` when the thrown value was not an `Error`. */
  name: string | null;
  /** Always present; falls back to a generic phrase for non-`Error` throws. */
  message: string;
  /** The captured stack, or `null` when the runtime did not provide one. */
  stack: string | null;
  /** The cloned `cause`, or `null`. Already transport-safe. */
  cause: unknown;
};

const isObjectLike = (value: unknown): value is object =>
  typeof value === "object" && value !== null;

/**
 * The built-in tag of a value — `"Map"`, `"Error"`, `"Uint8Array"`.
 *
 * `instanceof` is unusable here. Values crossing a realm boundary — an
 * iframe's object, a worker message, anything `structuredClone` returns —
 * carry a prototype from *that* realm, so `x instanceof Map` is false for a
 * perfectly real Map. Since this module exists to serialize values arriving
 * from exactly those places, it identifies them by tag instead.
 */
const tagOf = (value: unknown): string => Object.prototype.toString.call(value).slice(8, -1);

/** Cross-realm safe: catches a foreign `Error` as well as an `Error` subclass. */
const isErrorLike = (value: unknown): value is Error =>
  value instanceof Error || tagOf(value) === "Error";

/**
 * One entry in the path from the serialization root to the value being
 * visited. `raw` is the original value (what cycles point back to) and `out` is
 * what the replacer returned for it (what `this` will be for its children).
 * They differ whenever a value is transformed — an `Error` becomes a plain
 * object — so both are needed to track the path correctly.
 */
type AncestorFrame = { raw: unknown; out: unknown };

/**
 * Container types are tagged with a single bracketed key rather than replaced
 * by a summary string, so their contents survive the trip. `[Map]` and `[Set]`
 * read clearly in a panel, match the existing `[Circular]` / `[Function x]`
 * convention, and are vanishingly unlikely to collide with a real key.
 */
const describeValue = (value: unknown): unknown => {
  if (isErrorLike(value)) {
    return {
      name: value.name,
      message: value.message,
      stack: typeof value.stack === "string" ? value.stack : null,
      cause: "cause" in value ? (value.cause ?? null) : null
    };
  }
  if (value === undefined) {
    // JSON drops undefined properties entirely, which makes "set to undefined"
    // and "never present" look identical to whoever is reading the far end.
    return "[undefined]";
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    return `[${String(value)}]`;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }
  if (typeof value === "symbol") {
    return value.toString();
  }
  if (!isObjectLike(value)) {
    return value;
  }

  const tag = tagOf(value);
  if (tag === "Map") {
    return { "[Map]": [...(value as Map<unknown, unknown>).entries()] };
  }
  if (tag === "Set") {
    return { "[Set]": [...(value as Set<unknown>).values()] };
  }
  if (tag === "RegExp") {
    return String(value);
  }
  if (tag === "DataView" || tag === "ArrayBuffer" || tag === "SharedArrayBuffer") {
    return `[${tag} byteLength=${(value as ArrayBuffer | DataView).byteLength}]`;
  }
  // `ArrayBuffer.isView` inspects an internal slot, so it is realm-safe.
  if (ArrayBuffer.isView(value)) {
    return { [`[${tag}]`]: Array.from(value as unknown as ArrayLike<unknown>) };
  }
  return value;
};

/**
 * Deep-clones a value into a form that survives structured cloning and a JSON
 * round-trip, converting anything JSON cannot carry into a tagged, readable
 * stand-in.
 *
 * ## Guarantees
 *
 * **Never throws.** If a value defeats both `structuredClone` and
 * `JSON.stringify` — a throwing getter, a `toJSON` that fails — the result is
 * `String(value)`, and if even that throws it is `"[Unserializable]"`.
 *
 * **Never silently drops.** Every input value is represented by *something* in
 * the output. This is the whole point: the reader of a devtools payload has no
 * way to tell an omission from an absence, so an omission is a lie.
 *
 * **JSON-round-trippable.** The result survives
 * `JSON.parse(JSON.stringify(x))` unchanged, so it can cross a further
 * boundary without another pass.
 *
 * ## Conversions
 *
 * | Input | Output |
 * | --- | --- |
 * | `Error` | `{ name, message, stack, cause }` |
 * | `Map` | `{ "[Map]": [[key, value], …] }` |
 * | `Set` | `{ "[Set]": [value, …] }` |
 * | typed array | `{ "[Uint8Array]": [ … ] }` |
 * | `undefined` (nested) | `"[undefined]"` |
 * | `NaN`, `±Infinity` | `"[NaN]"`, `"[Infinity]"`, `"[-Infinity]"` |
 * | `bigint`, `symbol`, `RegExp` | their string forms |
 * | function | `"[Function name]"` |
 * | value on its own ancestor path | `"[Circular]"` |
 * | `ArrayBuffer`, `DataView` | `"[ArrayBuffer byteLength=n]"` |
 *
 * Cycle detection walks the *ancestor path*, not the set of everything seen. A
 * value referenced twice from different branches — the same context object held
 * under two keys, the same element twice in an array — is a diamond, not a
 * cycle, and is cloned in full both times. Marking it `"[Circular]"` would
 * silently blank out legitimate data in whatever is reading the far end.
 *
 * ## Accepted losses
 *
 * These are lossy by choice, because the output is a debugging view rather than
 * a format anything reconstructs from:
 *
 * - `Date` becomes an ISO string. Its `toJSON` runs before any replacer can see
 *   it, so intercepting it is not possible here. The same applies to any object
 *   defining `toJSON` — that method decides its own representation.
 * - `-0` becomes `0`.
 * - A tagged key such as `"[Map]"` occurring in real data is indistinguishable
 *   from a tag.
 *
 * @param value - Any runtime value.
 * @returns A transport-safe clone. A top-level `undefined` stays `undefined`,
 * so callers can still distinguish "nothing" from a value; nested `undefined`
 * becomes `"[undefined]"` because an absent key cannot express it.
 */
export const cloneForTransport = (value: unknown): unknown => {
  if (value === undefined) {
    return undefined;
  }

  const transportValue =
    typeof structuredClone === "function"
      ? (() => {
          try {
            return structuredClone(value);
          } catch {
            return value;
          }
        })()
      : value;

  const ancestors: AncestorFrame[] = [];

  try {
    const serialized = JSON.stringify(transportValue, function (this: unknown, _key, rawValue) {
      // `this` is the object currently holding `rawValue`. Unwinding to it
      // turns `ancestors` back into the exact path from the root, which is what
      // makes a sibling reference distinguishable from a cycle.
      while (ancestors.length > 0 && ancestors[ancestors.length - 1]?.out !== this) {
        ancestors.pop();
      }

      if (isObjectLike(rawValue) && ancestors.some((frame) => frame.raw === rawValue)) {
        return "[Circular]";
      }

      const described = describeValue(rawValue);
      if (isObjectLike(described)) {
        ancestors.push({ raw: rawValue, out: described });
      }
      return described;
    });

    // `JSON.stringify` yields undefined only for a root undefined, function, or
    // symbol. The first returns early above and the replacer converts the other
    // two to strings, so `serialized` is always a string here. Were that ever
    // to change, `JSON.parse` throws and the catch below still returns a value.
    return JSON.parse(serialized) as unknown;
  } catch {
    try {
      return String(value);
    } catch {
      // A null-prototype object has no `toString`, so even the last resort can
      // throw. Reachable in practice via `Object.create(null)` bags.
      return "[Unserializable]";
    }
  }
};

/**
 * Clones a cause for a {@link SerializedError}.
 *
 * `cloneForTransport` deliberately passes a top-level `undefined` straight
 * through, but `cause` is a declared field of a fixed shape — leaving it
 * `undefined` makes `JSON.stringify` drop the key altogether, so a consumer
 * sees no `cause` property at all rather than an explicit absence.
 */
const cloneCause = (cause: unknown): unknown => cloneForTransport(cause) ?? null;

/**
 * Describes a thrown value for transport, preserving as much of it as the
 * boundary allows.
 *
 * For an `Error`, the identifying fields are copied and `cause` is cloned. For
 * anything else there is no reliable name or stack, so the value itself is
 * cloned into `cause` — a thrown object or string is usually the only
 * diagnostic available, and dropping it leaves the far end with nothing.
 *
 * @param error - The caught value, of unknown shape.
 * @returns A fully transport-safe description. Never throws.
 */
export const serializeError = (error: unknown): SerializedError => {
  if (isErrorLike(error)) {
    const cause =
      "cause" in error && (error as { cause?: unknown }).cause !== undefined
        ? (error as { cause?: unknown }).cause
        : null;
    return {
      name: error.name,
      message: error.message,
      stack: typeof error.stack === "string" ? error.stack : null,
      cause: cloneCause(cause)
    };
  }

  return {
    name: null,
    message: typeof error === "string" ? error : "Unknown error",
    stack: null,
    cause: cloneCause(error)
  };
};

/**
 * Describes a failure that arrived *from* a transport, where the value has
 * usually already crossed a boundary and lost its prototype.
 *
 * The difference from {@link serializeError} is the middle case: a plain record
 * carrying `name`/`message`/`stack` is a structurally-cloned `Error` and its
 * fields are read directly, rather than being buried in `cause`. Everything
 * placed on the result is cloned, so the output can be forwarded across another
 * boundary without a second sanitising pass.
 *
 * @param error - The value received from the transport, of unknown shape.
 * @returns A fully transport-safe description. Never throws.
 */
export const serializeTransportError = (error: unknown): SerializedError => {
  if (isErrorLike(error)) {
    return {
      name: error.name,
      message: error.message,
      stack: typeof error.stack === "string" ? error.stack : null,
      cause: null
    };
  }

  if (isRecord(error)) {
    const message = typeof error.message === "string" ? error.message : null;
    const name = typeof error.name === "string" ? error.name : null;
    const stack = typeof error.stack === "string" ? error.stack : null;

    return {
      name,
      message: message ?? "Unknown transport error",
      stack,
      cause: "cause" in error ? cloneCause(error.cause) : null
    };
  }

  return {
    name: null,
    message: typeof error === "string" ? error : "Unknown transport error",
    stack: null,
    cause: null
  };
};
