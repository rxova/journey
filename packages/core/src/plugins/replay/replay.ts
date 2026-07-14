import { normalizeMaxEntries, serializeReplaySession, toSerializable } from "./replay.helpers";
import type { ReplayApi, ReplayEntry, ReplayEntryKind, ReplayPluginOptions } from "./replay.types";
import type { JourneyPlugin } from "../../core/types";

export { serializeReplaySession } from "./replay.helpers";
export type {
  ReplayApi,
  ReplayEntry,
  ReplayEntryKind,
  ReplayExportOptions,
  ReplayPluginOptions,
  ReplaySession
} from "./replay.types";

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
