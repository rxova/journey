import type { JourneyPlugin } from "../../core/types";

export type ReplayEntryKind = "status" | "transition" | "context" | "navigationBlocked" | "error";

export type ReplayEntry = {
  readonly at: number;
  readonly kind: ReplayEntryKind;
  readonly data: unknown;
  /** Present when `captureSnapshots` is enabled. */
  readonly snapshot?: unknown;
};

export type ReplaySession = {
  readonly startedAt: number;
  readonly entries: readonly ReplayEntry[];
};

export type ReplayPluginOptions = {
  /** Ring-buffer capacity. Defaults to 500; clamped to >= 1. */
  maxEntries?: number;
  /** Attach a serialized snapshot to each entry. Defaults to `true`. */
  captureSnapshots?: boolean;
  /** Injectable clock, mainly for tests. */
  now?: () => number;
};

export type ReplayExportOptions = { pretty?: boolean };

export type ReplayApi = {
  getReplaySession(): ReplaySession;
  clearReplaySession(): void;
  exportReplaySession(options?: ReplayExportOptions): string;
};

function normalizeMaxEntries(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 500;
  return Math.max(1, Math.trunc(value));
}

/** Converts any value into a JSON-safe structure (circular refs, errors, dates). */
function toSerializable(value: unknown, seen = new WeakSet<object>()): unknown {
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

/** Records snapshot and lifecycle activity into an exportable replay session. */
export function createReplayPlugin(
  options: ReplayPluginOptions = {}
): JourneyPlugin<"replay", ReplayApi, { entryCount: number }> {
  const maxEntries = normalizeMaxEntries(options.maxEntries);
  const captureSnapshots = options.captureSnapshots ?? true;
  const now = options.now ?? Date.now;

  return {
    name: "replay",
    setup(host) {
      let startedAt = now();
      let entries: ReplayEntry[] = [];

      const record = (kind: ReplayEntryKind, data: unknown) => {
        const entry: ReplayEntry = {
          at: now(),
          kind,
          data: toSerializable(data),
          ...(captureSnapshots ? { snapshot: toSerializable(host.getSnapshot()) } : {})
        };
        entries.push(entry);
        if (entries.length > maxEntries) {
          entries = entries.slice(entries.length - maxEntries);
        }
      };

      host.onTransition(({ from, to }) => record("transition", { from, to }));
      host.onStatusChange(({ previous, current }) => record("status", { previous, current }));
      host.onContextChange(({ previous, current }) => record("context", { previous, current }));
      host.onNavigationBlocked(({ reason, from, to }) =>
        record("navigationBlocked", { reason, from, to })
      );
      host.onError(({ phase, stepId, error }) => record("error", { phase, stepId, error }));

      return {
        api: {
          getReplaySession: () => ({ startedAt, entries: [...entries] }),
          clearReplaySession: () => {
            startedAt = now();
            entries = [];
          },
          exportReplaySession: (exportOptions) =>
            serializeReplaySession({ startedAt, entries: [...entries] }, exportOptions)
        },
        deriveSnapshot: (_snapshot, previous) =>
          previous?.entryCount === entries.length ? previous : { entryCount: entries.length }
      };
    }
  };
}
