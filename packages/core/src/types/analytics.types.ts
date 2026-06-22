import type {
  JourneyObservationEvent,
  JourneyTransitionSuccessObservationEvent
} from "./observation.types";
import type { JourneyBaseEvent, JourneyJsonObject, JourneyTerminal } from "./journey.types";

/** Standard analytics event names emitted by the analytics plugin. */
export type JourneyAnalyticsEventName =
  | "journey_started"
  | "step_viewed"
  | "step_exited"
  | "transition_started"
  | "transition_succeeded"
  | "transition_failed"
  | "journey_completed"
  | "journey_terminated"
  | "navigation_previous"
  | "navigation_last_visited"
  | (string & {});

/** Analytics payload emitted by the analytics plugin. */
export type JourneyAnalyticsEventPayload<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TStepMeta
> = Record<string, unknown> & {
  context?: TContext;
  stepId?: TStepId;
  stepMeta?: TStepMeta;
  from?: TStepId;
  to?: TStepId | JourneyTerminal;
  fromStepMeta?: TStepMeta;
  toStepMeta?: TStepMeta;
  durationMs?: number;
  dwellMs?: number;
  eventType?: string;
  transitionId?: JourneyTransitionSuccessObservationEvent<TStepId>["transitionId"];
  label?: JourneyTransitionSuccessObservationEvent<TStepId>["label"];
};

/** Event envelope passed to analytics trackers. */
export type JourneyAnalyticsTrackedEvent<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TStepMeta
> = {
  name: JourneyAnalyticsEventName;
  timestamp: number;
  machineId?: string;
  payload: JourneyAnalyticsEventPayload<TContext, TStepId, TStepMeta>;
};

/** Options for the analytics plugin. */
export type JourneyAnalyticsPluginOptions<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown
> = {
  track: (event: JourneyAnalyticsTrackedEvent<TContext, TStepId, TStepMeta>) => void;
  machineId?: string;
  includeStepMeta?: boolean;
  onError?: (
    error: unknown,
    event?:
      | JourneyObservationEvent<TStepId, TEvents>
      | JourneyAnalyticsTrackedEvent<TContext, TStepId, TStepMeta>
  ) => void;
};
