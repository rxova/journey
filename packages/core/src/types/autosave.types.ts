import type { JourneyMachineSnapshotReason } from "./machine.types";
import type { JourneyPersistenceOptions } from "./persistence.types";
import type { JourneyJsonObject, JourneySnapshot } from "./journey.types";

/** Autosave lifecycle status reported by the autosave plugin. */
export type JourneyAutosaveStatus = "idle" | "pending" | "saved" | "error";

/** Runtime autosave state exposed through the autosave plugin extension. */
export type JourneyAutosaveState = {
  status: JourneyAutosaveStatus;
  lastSavedAt?: number;
  pendingReason?: JourneyMachineSnapshotReason;
  error?: unknown;
};

/** Options for the autosave plugin. */
export type JourneyAutosavePluginOptions<
  TContext extends JourneyJsonObject,
  TStepId extends string
> = JourneyPersistenceOptions<TContext, TStepId> & {
  debounceMs?: number;
  hydrate?: boolean;
  saveOn?: readonly JourneyMachineSnapshotReason[];
  onSaved?: (details: {
    snapshot: JourneySnapshot<TContext, TStepId>;
    reason: JourneyMachineSnapshotReason;
    timestamp: number;
  }) => void;
};
