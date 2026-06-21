import type { JourneyMachineSnapshotReason } from "./machine.types";
import type { JourneyJsonObject, JourneySnapshot } from "./journey.types";
import type { JourneyObservationEvent } from "./observation.types";
import type { JourneyEmpty } from "./journey.types";

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
  TEventMap extends Record<string, unknown> = JourneyEmpty
> = {
  kind: "event";
  timestamp: number;
  event: JourneyObservationEvent<TStepId, TEventMap>;
};

/** Ordered replay entry captured from a live machine session. */
export type JourneyReplayEntry<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = JourneyEmpty
> = JourneyReplaySnapshotEntry<TContext, TStepId> | JourneyReplayEventEntry<TStepId, TEventMap>;

/** Full replay session captured from a journey machine. */
export type JourneyReplaySession<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = JourneyEmpty
> = {
  version: 1;
  initialSnapshot: JourneySnapshot<TContext, TStepId> | null;
  entries: JourneyReplayEntry<TContext, TStepId, TEventMap>[];
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
