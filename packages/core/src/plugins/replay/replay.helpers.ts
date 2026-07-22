import type { ReplayExportOptions, ReplaySession } from "./replay.types";

export function normalizeMaxEntries(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 500;
  return Math.max(1, Math.trunc(value));
}

/** Converts any value into a JSON-safe structure (circular refs, errors, dates). */
export function toSerializable(value: unknown, seen = new WeakSet<object>()): unknown {
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
  if (Array.isArray(value)) return value.map((item) => toSerializable(item, seen));
  if (typeof value === "object") {
    if (seen.has(value)) return "[circular]";
    seen.add(value);
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = toSerializable(item, seen);
    }
    seen.delete(value);
    return output;
  }
  return String(value);
}

/** Serializes a replay session into a JSON string safe for logging or export. */
export function serializeReplaySession(
  session: ReplaySession,
  options?: ReplayExportOptions
): string {
  return JSON.stringify(toSerializable(session), null, options?.pretty ? 2 : undefined);
}
