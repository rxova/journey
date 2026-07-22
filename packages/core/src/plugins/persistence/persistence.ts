import {
  buildPersistedState,
  parsePersistedState,
  resolvePersistStorage
} from "./persistence.helpers.js";
import type {
  JourneyPersistedState,
  PersistenceApi,
  PersistencePluginOptions
} from "./persistence.types.js";
import type { JourneyPersistOption, JourneyPlugin } from "../../core/types.js";

export { buildPersistedState, parsePersistedState } from "./persistence.helpers.js";
export type {
  JourneyPersistedState,
  JourneyStorage,
  PersistenceApi,
  PersistencePluginOptions
} from "./persistence.types.js";

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

/** Expands the creation-time `persist` option into the persistence plugin. */
export function persistOptionToPlugin(
  option: JourneyPersistOption
): JourneyPlugin<"persistence", PersistenceApi, { lastSavedAt: number | null }> {
  return createPersistencePlugin({ key: option.key, storage: resolvePersistStorage(option) });
}
