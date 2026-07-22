import {
  buildPersistedState,
  parsePersistedState,
  resolvePersistStorage
} from "./persistence.helpers";
import type {
  JourneyPersistedState,
  PersistenceApi,
  PersistencePluginOptions,
  PersistenceState
} from "./persistence.types";
import type { JourneyPersistOption, JourneyPlugin } from "../../core/types";

export { buildPersistedState, parsePersistedState } from "./persistence.helpers";
export type {
  JourneyPersistedState,
  JourneyStorage,
  PersistenceApi,
  PersistencePluginOptions,
  PersistenceState
} from "./persistence.types";

/**
 * Persists a serializable slice of machine state (status, context, timeline)
 * on every transition, status change, and context change.
 *
 * The plugin itself is save-side only (plugins observe, they cannot seed the
 * runtime). Restore happens through the creation-time `persist` option, which
 * reads a restorable record before the machine is built; `readPersisted()`
 * exposes the saved state for callers wiring this plugin explicitly.
 */
export function createPersistencePlugin(
  options: PersistencePluginOptions
): JourneyPlugin<"persistence", PersistenceApi, PersistenceState> {
  const now = options.now ?? Date.now;
  return {
    name: "persistence",
    setup(host) {
      let lastWritten: JourneyPersistedState | null = null;
      let lastError: unknown = null;

      const succeeded = (state: JourneyPersistedState) => {
        lastWritten = state;
        lastError = null;
      };

      const failed = (error: unknown) => {
        lastError = error;
        host.reportError(error);
      };

      const save = () => {
        const state = buildPersistedState(host.getSnapshot(), now());
        let written: void | Promise<void>;
        try {
          written = options.storage.setItem(options.key, JSON.stringify(state));
        } catch (error) {
          // Recorded here, but rethrown so the runtime's listener isolation
          // reports it exactly as it always did.
          lastError = error;
          throw error;
        }
        // `setItem` may be async. Discarding that promise turned a rejecting
        // adapter into an unhandled rejection, which terminates the process
        // under Node's default `--unhandled-rejections=throw`.
        if (written !== undefined) {
          void written.then(() => succeeded(state), failed);
          return;
        }
        succeeded(state);
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
          getPersistenceState: () => ({
            lastSavedAt: lastWritten?.savedAt ?? null,
            error: lastError
          }),
          readPersisted: () => parsePersistedState(options.storage.getItem(options.key)),
          clearPersisted: () => {
            lastWritten = null;
            options.storage.removeItem(options.key);
          }
        },
        deriveSnapshot: (_snapshot, previous) => {
          const lastSavedAt = lastWritten?.savedAt ?? null;
          return previous && previous.lastSavedAt === lastSavedAt && previous.error === lastError
            ? previous
            : { lastSavedAt, error: lastError };
        }
      };
    }
  };
}

/** Expands the creation-time `persist` option into the persistence plugin. */
export function persistOptionToPlugin(
  option: JourneyPersistOption
): JourneyPlugin<"persistence", PersistenceApi, PersistenceState> {
  return createPersistencePlugin({ key: option.key, storage: resolvePersistStorage(option) });
}
