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
 * One entry in the path from the serialization root to the value being
 * visited. `raw` is the original value (what cycles point back to) and `out` is
 * what the replacer returned for it (what `this` will be for its children).
 * They differ whenever a value is transformed — an `Error` becomes a plain
 * object — so both are needed to track the path correctly.
 */
type AncestorFrame = { raw: unknown; out: unknown };

const describeValue = (value: unknown): unknown => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: typeof value.stack === "string" ? value.stack : null,
      cause: "cause" in value ? (value.cause ?? null) : null
    };
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
  return value;
};

/**
 * Deep-clones a value into a form that survives structured cloning and JSON
 * round-trips, replacing anything that cannot cross a boundary with a readable
 * placeholder.
 *
 * Conversions: `Error` becomes `{ name, message, stack, cause }`, `bigint` and
 * `symbol` become their string forms, functions become `"[Function name]"`, and
 * a value that points back into its own path becomes `"[Circular]"`.
 *
 * Cycle detection walks the *ancestor path*, not the set of everything seen. A
 * value referenced twice from different branches — the same context object held
 * under two keys, the same element twice in an array — is a diamond, not a
 * cycle, and is cloned in full both times. Marking it `"[Circular]"` would
 * silently blank out legitimate data in whatever is reading the far end.
 *
 * Never throws: if a value defeats both `structuredClone` and `JSON.stringify`
 * (a throwing getter, a `toJSON` that fails), the result is `String(value)`, and
 * if even that throws the result is a fixed placeholder.
 *
 * @param value - Any runtime value.
 * @returns A transport-safe clone. `undefined` in, `undefined` out.
 */
export const cloneForTransport = (value: unknown): unknown => {
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

    return serialized === undefined ? undefined : (JSON.parse(serialized) as unknown);
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
  if (error instanceof Error) {
    const cause =
      "cause" in error && (error as { cause?: unknown }).cause !== undefined
        ? (error as { cause?: unknown }).cause
        : null;
    return {
      name: error.name,
      message: error.message,
      stack: typeof error.stack === "string" ? error.stack : null,
      cause: cloneForTransport(cause)
    };
  }

  return {
    name: null,
    message: typeof error === "string" ? error : "Unknown error",
    stack: null,
    cause: cloneForTransport(error)
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
  if (error instanceof Error) {
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
      cause: "cause" in error ? cloneForTransport(error.cause ?? null) : null
    };
  }

  return {
    name: null,
    message: typeof error === "string" ? error : "Unknown transport error",
    stack: null,
    cause: null
  };
};
