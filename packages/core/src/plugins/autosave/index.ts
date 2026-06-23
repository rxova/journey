import { createPersistenceController } from "../persistence/controller";

import type {
  JourneyBaseEvent,
  JourneyAutosavePluginOptions,
  JourneyAutosaveState,
  JourneyJsonObject,
  JourneyMachine,
  JourneyMachinePlugin,
  JourneyMachineSnapshotReason,
  JourneySnapshot
} from "../../types";
import type { JourneyEmpty } from "../../types";

const DEFAULT_SAVE_REASONS = ["context", "navigation", "reset", "start", "transition"] as const;

const normalizeDebounceMs = (value: number | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 300;
  }

  return Math.max(0, Math.trunc(value));
};

export type JourneyAutosaveMachineExtension = {
  getAutosaveState: () => JourneyAutosaveState;
  flushAutosave: () => Promise<void>;
  clearAutosave: () => void;
};

export type JourneyAutosaveMachine<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = JourneyMachine<TContext, TStepId, TEvents, TStepMeta, THandlers> &
  JourneyAutosaveMachineExtension;

/**
 * Creates a plugin that debounces snapshot persistence and exposes autosave
 * runtime state without requiring the persistence plugin as a public dependency.
 */
export const createAutosavePlugin = <TContext extends JourneyJsonObject, TStepId extends string>(
  options: JourneyAutosavePluginOptions<TContext, TStepId>
) => {
  const debounceMs = normalizeDebounceMs(options.debounceMs);
  const hydrate = options.hydrate ?? true;
  const saveReasons = new Set(options.saveOn ?? DEFAULT_SAVE_REASONS);

  // Per-instance state lives inside `setup()` (called once per machine) so a
  // single plugin instance reused across machines never shares its timer/state.
  const setup = (({ resolvedJourney }) => {
    let autosaveState: JourneyAutosaveState = { status: "idle" };
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let pending: {
      snapshot: JourneySnapshot<JourneyJsonObject, string>;
      reason: JourneyMachineSnapshotReason;
    } | null = null;
    let lastSaveErrored = false;

    const resolvedOptions = options as unknown as JourneyAutosavePluginOptions<TContext, TStepId>;
    const controller = createPersistenceController({
      initial: resolvedJourney.initial as unknown as TStepId,
      context: resolvedJourney.context as unknown as TContext,
      steps: resolvedJourney.steps as unknown as Record<TStepId, unknown>,
      options: {
        ...resolvedOptions,
        onError: (error) => {
          lastSaveErrored = true;
          autosaveState = {
            status: "error",
            ...(autosaveState.lastSavedAt !== undefined
              ? { lastSavedAt: autosaveState.lastSavedAt }
              : {}),
            ...(autosaveState.pendingReason !== undefined
              ? { pendingReason: autosaveState.pendingReason }
              : {}),
            error
          };
          resolvedOptions.onError?.(error);
        }
      } as JourneyAutosavePluginOptions<TContext, TStepId>
    });

    const clearTimer = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const commitPending = () => {
      clearTimer();
      if (!pending) {
        return;
      }

      const current = pending;
      pending = null;
      lastSaveErrored = false;
      controller.persistSnapshot(
        current.snapshot as unknown as Parameters<typeof controller.persistSnapshot>[0]
      );
      if (lastSaveErrored) {
        return;
      }

      const timestamp = Date.now();
      autosaveState = {
        status: "saved",
        lastSavedAt: timestamp
      };
      resolvedOptions.onSaved?.({
        snapshot: current.snapshot as unknown as JourneySnapshot<TContext, TStepId>,
        reason: current.reason,
        timestamp
      });
    };

    const scheduleSave = (
      snapshot: Parameters<typeof controller.persistSnapshot>[0],
      reason: JourneyMachineSnapshotReason
    ) => {
      pending = {
        snapshot: snapshot as unknown as JourneySnapshot<JourneyJsonObject, string>,
        reason
      };
      autosaveState = {
        status: "pending",
        ...(autosaveState.lastSavedAt !== undefined
          ? { lastSavedAt: autosaveState.lastSavedAt }
          : {}),
        pendingReason: reason
      };

      if (debounceMs === 0) {
        commitPending();
        return;
      }

      clearTimer();
      timeoutId = setTimeout(() => {
        commitPending();
      }, debounceMs);
    };

    return {
      hydrateSnapshot: (snapshot) =>
        hydrate
          ? (controller.hydrateSnapshot(snapshot as never) as unknown as typeof snapshot)
          : snapshot,
      onSnapshotChange: ({ snapshot, reason }) => {
        if (reason === "async") {
          return;
        }

        if (reason === "reset" && controller.clearOnReset) {
          clearTimer();
          pending = null;
          controller.removePersistedSnapshot();
          autosaveState = { status: "idle" };
          return;
        }

        if (!saveReasons.has(reason)) {
          return;
        }

        scheduleSave(
          snapshot as unknown as Parameters<typeof controller.persistSnapshot>[0],
          reason
        );
      },
      augmentMachine: () => ({
        getAutosaveState: () => ({ ...autosaveState }),
        flushAutosave: async () => {
          commitPending();
        },
        clearAutosave: () => {
          clearTimer();
          pending = null;
          controller.removePersistedSnapshot();
          autosaveState = { status: "idle" };
        }
      }),
      getDevtoolsFeatures: () => [
        {
          id: "autosave",
          label: "Autosave",
          operations: [
            {
              id: "autosave.inspect",
              label: "inspect",
              mutates: false,
              output: "data",
              run: () => ({
                kind: "data",
                data: {
                  state: { ...autosaveState },
                  debounceMs,
                  hydrate,
                  saveOn: [...saveReasons],
                  persistence: controller.inspectPersistedState()
                }
              })
            },
            {
              id: "autosave.flush",
              label: "flush",
              mutates: true,
              output: "void",
              run: async () => {
                commitPending();
                return { kind: "void" };
              }
            },
            {
              id: "autosave.clear",
              label: "clear",
              mutates: true,
              output: "void",
              run: () => {
                clearTimer();
                pending = null;
                controller.removePersistedSnapshot();
                autosaveState = { status: "idle" };
                return { kind: "void" };
              }
            }
          ]
        }
      ],
      dispose: () => {
        clearTimer();
      }
    };
  }) as JourneyMachinePlugin["setup"];

  return {
    name: "autosave",
    __extension__: undefined as unknown as JourneyAutosaveMachineExtension,
    setup
  } satisfies JourneyMachinePlugin;
};

export type { JourneyAutosavePluginOptions, JourneyAutosaveState } from "../../types";
