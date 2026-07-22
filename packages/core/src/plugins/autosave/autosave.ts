import { DEFAULT_SAVE_REASONS, normalizeDebounceMs } from "./autosave.helpers.js";
import { buildPersistedState, parsePersistedState } from "../persistence/persistence.helpers.js";
import type {
  AutosaveApi,
  AutosavePluginOptions,
  AutosaveReason,
  AutosaveState
} from "./autosave.types.js";
import type { JourneyPlugin } from "../../core/types.js";

export { DEFAULT_SAVE_REASONS, normalizeDebounceMs } from "./autosave.helpers.js";
export type {
  AutosaveApi,
  AutosavePluginOptions,
  AutosaveReason,
  AutosaveState
} from "./autosave.types.js";

/**
 * Debounced persistence: schedules a save after each observed change and
 * writes the same serializable state slice as the persistence plugin.
 */
export function createAutosavePlugin(
  options: AutosavePluginOptions
): JourneyPlugin<"autosave", AutosaveApi, AutosaveState> {
  const debounceMs = normalizeDebounceMs(options.debounceMs);
  const saveReasons = new Set(options.saveOn ?? DEFAULT_SAVE_REASONS);
  const now = options.now ?? Date.now;

  return {
    name: "autosave",
    setup(host) {
      let state: AutosaveState = { status: "idle", lastSavedAt: null, error: null };
      let timer: ReturnType<typeof setTimeout> | null = null;
      let disposed = false;

      const save = async (): Promise<void> => {
        state = { ...state, status: "saving" };
        try {
          const persisted = buildPersistedState(host.getSnapshot(), now());
          await options.storage.setItem(options.key, JSON.stringify(persisted));
          state = { status: "saved", lastSavedAt: persisted.savedAt, error: null };
        } catch (error) {
          state = { ...state, status: "error", error };
        }
      };

      const cancelTimer = () => {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
      };

      const schedule = (reason: AutosaveReason) => {
        if (disposed || !saveReasons.has(reason)) return;
        cancelTimer();
        state = { ...state, status: "pending" };
        timer = setTimeout(() => {
          timer = null;
          void save();
        }, debounceMs);
      };

      host.onContextChange(() => schedule("context"));
      host.onTransition(() => schedule("transition"));
      host.onStatusChange(() => schedule("status"));
      host.onDispose(() => {
        disposed = true;
        cancelTimer();
      });

      return {
        api: {
          getAutosaveState: () => state,
          flushAutosave: () => {
            cancelTimer();
            return save();
          },
          clearAutosave: () => {
            cancelTimer();
            state = { status: "idle", lastSavedAt: null, error: null };
            options.storage.removeItem(options.key);
          },
          readPersisted: () => parsePersistedState(options.storage.getItem(options.key))
        },
        deriveSnapshot: (_snapshot, previous) => (previous === state ? previous : state)
      };
    }
  };
}
