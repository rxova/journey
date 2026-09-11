import { warnInDevelopment } from "@rxova/journey-common/dev";
import {
  buildPersistedState,
  DEFAULT_SAVE_REASONS,
  normalizeDebounceMs,
  parsePersistedState,
  resolvePersistStorage
} from "./persistence.helpers";
import type {
  JourneyPersistedState,
  PersistenceApi,
  PersistencePluginOptions,
  PersistenceReason,
  PersistenceState
} from "./persistence.types";
import type { JourneyPersistOption, JourneyPlugin } from "../../core/types";

export {
  buildPersistedState,
  DEFAULT_SAVE_REASONS,
  normalizeDebounceMs,
  parsePersistedState
} from "./persistence.helpers";
export type {
  JourneyPersistedState,
  JourneyStorage,
  PersistenceApi,
  PersistencePluginOptions,
  PersistenceReason,
  PersistenceState
} from "./persistence.types";

const IDLE_STATE: PersistenceState = { status: "idle", lastSavedAt: null, error: null };

/**
 * Persists a serializable slice of machine state (status, context, timeline) on
 * every transition, status change, and context change. `saveOn` narrows which
 * of those trigger a write; `debounceMs` collapses a burst of them into one.
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
  const debounceMs = normalizeDebounceMs(options.debounceMs);
  const saveReasons = new Set<PersistenceReason>(options.saveOn ?? DEFAULT_SAVE_REASONS);
  // Per plugin *instance*, not per machine: mutable state is scoped to setup(),
  // but `options` is not — two machines sharing one instance write the same key
  // and silently clobber each other.
  let setupCount = 0;
  return {
    name: "persistence",
    setup(host) {
      setupCount += 1;
      if (setupCount > 1) {
        warnInDevelopment(
          `journey: persistence plugin instance shared by ${setupCount} machines; they overwrite key "${options.key}". Create one per machine.`
        );
      }
      let lastWritten: JourneyPersistedState | null = null;
      let state: PersistenceState = IDLE_STATE;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let disposed = false;

      const succeeded = (written: JourneyPersistedState) => {
        lastWritten = written;
        state = { status: "saved", lastSavedAt: written.savedAt, error: null };
      };

      const failed = (error: unknown) => {
        state = { ...state, status: "error", error };
        host.reportError(error);
      };

      /**
       * Writes now. Returns a promise only so `flushPersisted` can be awaited;
       * the immediate path stays synchronous up to the `setItem` call, which is
       * what lets a throwing adapter surface through the runtime's listener
       * isolation exactly as it always did.
       */
      const save = (): void | Promise<void> => {
        const written = buildPersistedState(host.getSnapshot(), now());
        state = { ...state, status: "saving" };
        let result: void | Promise<void>;
        try {
          result = options.storage.setItem(options.key, JSON.stringify(written));
        } catch (error) {
          // Recorded here, but rethrown so the runtime's listener isolation
          // reports it exactly as it always did.
          state = { ...state, status: "error", error };
          throw error;
        }
        // `setItem` may be async. Discarding that promise turned a rejecting
        // adapter into an unhandled rejection, which terminates the process
        // under Node's default `--unhandled-rejections=throw`.
        if (result !== undefined) {
          return result.then(() => succeeded(written), failed);
        }
        succeeded(written);
      };

      const cancelTimer = () => {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
      };

      /**
       * A debounced write happens on a timer, so there is no synchronous caller
       * left to throw to — its failures land in `state` and `reportError`
       * instead. The immediate path keeps throwing.
       */
      const runDebounced = () => {
        timer = null;
        try {
          const result = save();
          if (result !== undefined) void result;
        } catch (error) {
          failed(error);
        }
      };

      const onObservation = (reason: PersistenceReason) => {
        if (disposed || !saveReasons.has(reason)) return;
        if (debounceMs === 0) {
          void save();
          return;
        }
        cancelTimer();
        state = { ...state, status: "pending" };
        timer = setTimeout(runDebounced, debounceMs);
      };

      host.onContextChange(() => onObservation("context"));
      host.onTransition(() => onObservation("transition"));
      host.onStatusChange(({ current }) => {
        if (current === "terminated" && options.clearOnTerminate) {
          cancelTimer();
          lastWritten = null;
          state = IDLE_STATE;
          options.storage.removeItem(options.key);
          return;
        }
        onObservation("status");
      });
      host.onDispose(() => {
        disposed = true;
        cancelTimer();
      });

      return {
        api: {
          inspectPersistedState: () => lastWritten,
          getPersistenceState: () => state,
          readPersisted: () => parsePersistedState(options.storage.getItem(options.key)),
          clearPersisted: () => {
            cancelTimer();
            lastWritten = null;
            state = IDLE_STATE;
            // Called directly by user code; record the failure here rather than
            // throwing out of an API whose sibling writes are all contained.
            try {
              options.storage.removeItem(options.key);
            } catch (error) {
              failed(error);
            }
          },
          flushPersisted: async () => {
            cancelTimer();
            try {
              await save();
            } catch (error) {
              failed(error);
            }
          }
        },
        deriveSnapshot: (_snapshot, previous) => (previous === state ? previous : state)
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
