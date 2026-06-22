import type { JourneyMachineSnapshotReason } from "./machine.types";
import type { JourneyBaseEvent, JourneyJsonObject, JourneySnapshot } from "./journey.types";
import type { JourneyObservationEvent } from "./observation.types";

/** Snapshot entry captured by the replay plugin. */
export type JourneyReplaySnapshotEntry<
  TContext extends JourneyJsonObject,
  TStepId extends string
> = {
  kind: "snapshot";
  timestamp: number;
  reason: JourneyMachineSnapshotReason;
  snapshot: JourneySnapshot<TContext, TStepId>;
};

/** Observation event entry captured by the replay plugin. */
export type JourneyReplayEventEntry<
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never
> = {
  kind: "event";
  timestamp: number;
  event: JourneyObservationEvent<TStepId, TEvents>;
};

/** Ordered replay entry captured from a live machine session. */
export type JourneyReplayEntry<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never
> = JourneyReplaySnapshotEntry<TContext, TStepId> | JourneyReplayEventEntry<TStepId, TEvents>;

/** Full replay session captured from a journey machine. */
export type JourneyReplaySession<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never
> = {
  version: 1;
  initialSnapshot: JourneySnapshot<TContext, TStepId> | null;
  entries: JourneyReplayEntry<TContext, TStepId, TEvents>[];
  truncated: boolean;
};

/** Runtime options for the replay plugin. */
export type JourneyReplayPluginOptions = {
  maxEntries?: number;
  captureEvents?: boolean;
  captureSnapshots?: boolean;
};

/** Serialization options for `exportReplaySession()`. */
export type JourneyReplayExportOptions = {
  pretty?: boolean;
};
