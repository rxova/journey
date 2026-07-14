import type {
  JourneyBaseEvent,
  JourneyDefaultEventType,
  JourneyJsonObject,
  JourneyPayloadFor,
  JourneySendEvent,
  JourneySendResult,
  JourneySnapshot
} from "@rxova/journey-core";
import type { JourneyCustomSendEventForKeys } from "./type-helpers";

export type JourneyDefaultEvent = JourneyDefaultEventType;

/** The imperative machine surface exposed by the graph tier's `useApi()`. */
export type JourneyApi<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown
> = {
  startJourney: () => Promise<JourneySnapshot<TContext, TStepId>>;
  send: (
    event: JourneySendEvent<TStepId, TEvents>
  ) => Promise<JourneySendResult<TContext, TStepId>>;
  goToNextStep: () => Promise<JourneySendResult<TContext, TStepId>>;
  goToStepById: (stepId: TStepId) => Promise<JourneySendResult<TContext, TStepId>>;
  terminateJourney: (
    payload?: JourneyPayloadFor<TEvents, "terminateJourney">
  ) => Promise<JourneySendResult<TContext, TStepId>>;
  completeJourney: (
    payload?: JourneyPayloadFor<TEvents, "completeJourney">
  ) => Promise<JourneySendResult<TContext, TStepId>>;
  goToPreviousStep: (steps?: number) => Promise<JourneySendResult<TContext, TStepId>>;
  goToLastVisitedStep: () => Promise<JourneySendResult<TContext, TStepId>>;
  clearStepError: (stepId?: TStepId) => Promise<JourneySnapshot<TContext, TStepId>>;
  updateContext: (
    updater: (context: TContext) => TContext
  ) => Promise<JourneySnapshot<TContext, TStepId>>;
  getStepMeta: (stepId: TStepId) => TStepMeta | undefined;
  /** Transient pause: while paused, navigation/send resolve as no-ops (`noOpReason: "paused"`). */
  pauseJourney: () => void;
  resumeJourney: () => void;
  isPaused: () => boolean;
  resetJourney: () => Promise<JourneySnapshot<TContext, TStepId>>;
};

/** `JourneyApi` narrowed so `send` only accepts the events a step declares. */
export type StepScopedJourneyApi<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TAllowedEventType extends TEvents["type"] = never,
  TStepMeta = unknown
> = Omit<JourneyApi<TContext, TStepId, TEvents, TStepMeta>, "send"> & {
  send: (
    event: JourneyCustomSendEventForKeys<TEvents, TAllowedEventType>
  ) => Promise<JourneySendResult<TContext, TStepId>>;
};
