import type { ReplayExportOptions, ReplaySession } from "./replay.types";

export function normalizeMaxEntries(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 500;
  return Math.max(1, Math.trunc(value));
}

/**
 * Depth past which nesting is truncated instead of walked. Guards the call
 * stack: a long parent/child chain used to overflow it, and the resulting
 * RangeError was swallowed by listener isolation, silently dropping the entry.
 */
export const DEFAULT_MAX_DEPTH = 100;

const CIRCULAR = "[circular]";
const TRUNCATED = "[max-depth]";

type WalkState = {
  /** Completed conversions, so a shared subtree is walked exactly once. */
  readonly memo: Map<object, unknown>;
  /** Objects on the current path — these, and only these, are cycles. */
  readonly inProgress: Set<object>;
  readonly maxDepth: number;
};

function walk(value: unknown, state: WalkState, depth: number): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "undefined") return null;
  if (typeof value === "function" || typeof value === "symbol") {
    return `[unsupported:${typeof value}]`;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(value.stack ? { stack: value.stack } : {})
    };
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return String(value);

  const object = value as object;
  if (state.memo.has(object)) return state.memo.get(object);
  if (state.inProgress.has(object)) return CIRCULAR;
  if (depth >= state.maxDepth) return TRUNCATED;

  state.inProgress.add(object);
  let result: unknown;
  if (Array.isArray(value)) {
    result = value.map((item) => walk(item, state, depth + 1));
  } else {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = walk(item, state, depth + 1);
    }
    result = output;
  }
  state.inProgress.delete(object);
  state.memo.set(object, result);
  return result;
}

/**
 * Converts any value into a JSON-safe structure (circular refs, errors, dates).
 *
 * Memoized by reference, which is what keeps it linear in the number of
 * distinct objects. The previous walk removed each node from its `seen` set on
 * the way back up — correct for cycles, but it meant a shared subtree was
 * re-traversed once per path reaching it, so a context with diamond-shaped
 * sharing cost 2^N. Since the replay plugin serializes the whole snapshot on
 * every transition by default, that ran on the hot path: measured 21 ms at
 * depth 14, 241 ms at 18, 932 ms at 20, and no completion at 26.
 *
 * Arrays are now cycle-tracked too. They were checked before the object branch
 * and never entered `seen`, so a self-referencing array recursed until the
 * stack gave out.
 */
export function toSerializable(value: unknown, options: { maxDepth?: number } = {}): unknown {
  return walk(
    value,
    {
      memo: new Map<object, unknown>(),
      inProgress: new Set<object>(),
      maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH
    },
    0
  );
}

/** Serializes a replay session into a JSON string safe for logging or export. */
export function serializeReplaySession(
  session: ReplaySession,
  options?: ReplayExportOptions
): string {
  return JSON.stringify(toSerializable(session), null, options?.pretty ? 2 : undefined);
}
