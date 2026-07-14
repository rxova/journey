import { buildPersistedState, parsePersistedState } from "../persistence/state";
import type { JourneyPersistedState, JourneyStorage } from "../persistence/state";
import type { JourneyPlugin } from "../../core/types";

export type AutosaveReason = "context" | "transition" | "status";

export type AutosavePluginOptions = {
  storage: JourneyStorage;
  key: string;
  /** Debounce window in milliseconds. Defaults to 300; clamped to >= 0. */
  debounceMs?: number;
  /** Which observations schedule a save. Defaults to all of them. */
  saveOn?: readonly AutosaveReason[];
  /** Injectable clock, mainly for tests. */
  now?: () => number;
};

export type AutosaveState = {
  readonly status: "idle" | "pending" | "saving" | "saved" | "error";
  readonly lastSavedAt: number | null;
  readonly error: unknown | null;
};

export type AutosaveApi = {
  getAutosaveState(): AutosaveState;
  /** Cancels the debounce and saves immediately. */
  flushAutosave(): Promise<void>;
  /** Cancels any pending save and removes the persisted entry. */
  clearAutosave(): void;
  readPersisted(): JourneyPersistedState | null;
};

const DEFAULT_SAVE_REASONS: readonly AutosaveReason[] = ["context", "transition", "status"];

function normalizeDebounceMs(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 300;
  return Math.max(0, Math.trunc(value));
}

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
