import type { JourneySendEvent, JourneyTerminal } from "./journey.types";

export type JourneyLifecycleErrorPhase =
  | "step.onLeave"
  | "transition.onLeave"
  | "step.onEnter"
  | "transition.onEnter";

export type JourneyStartObservationEvent<TStepId extends string> = {
  type: "journey.start";
  stepId: TStepId;
  timestamp: number;
};

export type JourneyResetObservationEvent<TStepId extends string> = {
  type: "journey.reset";
  stepId: TStepId;
  timestamp: number;
};

export type JourneyTransitionStartObservationEvent<
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>
> = {
  type: "transition.start";
  from: TStepId;
  event: JourneySendEvent<TStepId, TEventMap>;
  timestamp: number;
};

export type JourneyTransitionSuccessObservationEvent<TStepId extends string> = {
  type: "transition.success";
  from: TStepId;
  to: TStepId | JourneyTerminal;
  eventType: string;
  transitionId: string | null;
  label?: string;
  timestamp: number;
};

export type JourneyTransitionErrorObservationEvent<TStepId extends string> = {
  type: "transition.error";
  from: TStepId;
  eventType: string;
  transitionId: string | null;
  label?: string;
  error: unknown;
  timestamp: number;
};

export type JourneyLifecycleErrorObservationEvent<TStepId extends string> = {
  type: "lifecycle.error";
  phase: JourneyLifecycleErrorPhase;
  from: TStepId;
  to: TStepId | JourneyTerminal;
  eventType: string;
  transitionId: string | null;
  label?: string;
  error: unknown;
  timestamp: number;
};

export type JourneyStepExitObservationEvent<TStepId extends string> = {
  type: "step.exit";
  stepId: TStepId;
  timestamp: number;
};

export type JourneyStepEnterObservationEvent<TStepId extends string> = {
  type: "step.enter";
  stepId: TStepId;
  timestamp: number;
};

export type JourneyCompleteObservationEvent<TStepId extends string> = {
  type: "journey.completed";
  stepId: TStepId;
  timestamp: number;
};

export type JourneyTerminateObservationEvent<TStepId extends string> = {
  type: "journey.terminated";
  stepId: TStepId;
  timestamp: number;
};

export type JourneyPreviousNavigationObservationEvent<TStepId extends string> = {
  type: "navigation.previous";
  from: TStepId;
  to: TStepId;
  requestedSteps: number;
  appliedSteps: number;
  timestamp: number;
};

export type JourneyLastVisitedNavigationObservationEvent<TStepId extends string> = {
  type: "navigation.lastVisited";
  from: TStepId;
  to: TStepId;
  timestamp: number;
};

/** Observation events emitted by the machine lifecycle/event stream. */
export type JourneyObservationEvent<
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>
> =
  | JourneyStartObservationEvent<TStepId>
  | JourneyResetObservationEvent<TStepId>
  | JourneyTransitionStartObservationEvent<TStepId, TEventMap>
  | JourneyTransitionSuccessObservationEvent<TStepId>
  | JourneyTransitionErrorObservationEvent<TStepId>
  | JourneyLifecycleErrorObservationEvent<TStepId>
  | JourneyStepExitObservationEvent<TStepId>
  | JourneyStepEnterObservationEvent<TStepId>
  | JourneyCompleteObservationEvent<TStepId>
  | JourneyTerminateObservationEvent<TStepId>
  | JourneyPreviousNavigationObservationEvent<TStepId>
  | JourneyLastVisitedNavigationObservationEvent<TStepId>;
