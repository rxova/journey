import { buildPersistedState, parsePersistedState } from "./state";
import type { JourneyPersistedState, JourneyStorage } from "./state";
import type { JourneyPlugin } from "../../core/types";

export type { JourneyPersistedState, JourneyStorage } from "./state";

export type PersistencePluginOptions = {
  storage: JourneyStorage;
  key: string;
  /** Remove the persisted entry when the journey terminates. Defaults to `false`. */
  clearOnTerminate?: boolean;
  /** Injectable clock, mainly for tests. */
  now?: () => number;
};

export type PersistenceApi = {
  /** The last state written by this run (not re-read from storage). */
  inspectPersistedState(): JourneyPersistedState | null;
  /** Re-reads and parses storage; `null` when absent or malformed. */
  readPersisted(): JourneyPersistedState | null;
  clearPersisted(): void;
};

/**
 * Persists a serializable slice of machine state (status, context, timeline)
 * on every transition, status change, and context change.
 *
 * Rehydration into a running machine is a planned core feature (restore saved
 * history); until then `readPersisted()` exposes the saved state so callers
 * can seed a new journey's `context` themselves.
 */
export function createPersistencePlugin(
  options: PersistencePluginOptions
): JourneyPlugin<"persistence", PersistenceApi, { lastSavedAt: number | null }> {
  const now = options.now ?? Date.now;
  return {
    name: "persistence",
    setup(host) {
      let lastWritten: JourneyPersistedState | null = null;

      const save = () => {
        const state = buildPersistedState(host.getSnapshot(), now());
        lastWritten = state;
        void options.storage.setItem(options.key, JSON.stringify(state));
      };

      host.onTransition(save);
      host.onContextChange(save);
      host.onStatusChange(({ current }) => {
        if (current === "terminated" && options.clearOnTerminate) {
          lastWritten = null;
          options.storage.removeItem(options.key);
          return;
        }
        save();
      });

      return {
        api: {
          inspectPersistedState: () => lastWritten,
          readPersisted: () => parsePersistedState(options.storage.getItem(options.key)),
          clearPersisted: () => {
            lastWritten = null;
            options.storage.removeItem(options.key);
          }
        },
        deriveSnapshot: (_snapshot, previous) => {
          const lastSavedAt = lastWritten?.savedAt ?? null;
          return previous && previous.lastSavedAt === lastSavedAt ? previous : { lastSavedAt };
        }
      };
    }
  };
}
