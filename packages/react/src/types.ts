import type React from "react";

import type {
  JourneyDefinition,
  JourneyEqualityFn,
  JourneyEventPayloadMap as JourneyCoreEventPayloadMap,
  JourneyMachine,
  JourneyObservationEvent,
  JourneyPayloadFor,
  JourneyPersistenceOptions,
  JourneySelector,
  JourneySendEvent,
  JourneySendResult,
  JourneySnapshot,
  JourneyStepDefinition
} from "@rxova/journey-core";

export type JourneyDefaultEvent =
  | "goToNextStep"
  | "goToPreviousStep"
  | "terminateJourney"
  | "completeJourney";

export type JourneyEventType<TCustomEvent extends string = never> =
  | JourneyDefaultEvent
  | TCustomEvent;
export type JourneyReactEventPayloadMap<TCustomEvent extends string = never> =
  JourneyCoreEventPayloadMap<JourneyEventType<TCustomEvent>>;

export type JourneyReactStep<TStepMeta = unknown> = JourneyStepDefinition<TStepMeta> & {
  component: React.ComponentType;
};

export type JourneyReactDefinition<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
> = Omit<
  JourneyDefinition<TContext, TStepId, JourneyEventType<TCustomEvent>, TEventPayloadMap, TStepMeta>,
  "steps"
> & {
  steps: Record<TStepId, JourneyReactStep<TStepMeta>>;
};

export type JourneyApi<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
> = {
  send: (
    event: JourneySendEvent<TStepId, JourneyEventType<TCustomEvent>, TEventPayloadMap>
  ) => Promise<JourneySendResult<TContext, TStepId, TStepMeta>>;
  goToNextStep: () => Promise<JourneySendResult<TContext, TStepId, TStepMeta>>;
  terminateJourney: (
    payload?: JourneyPayloadFor<
      JourneyEventType<TCustomEvent>,
      TEventPayloadMap,
      "terminateJourney"
    >
  ) => Promise<JourneySendResult<TContext, TStepId, TStepMeta>>;
  completeJourney: (
    payload?: JourneyPayloadFor<JourneyEventType<TCustomEvent>, TEventPayloadMap, "completeJourney">
  ) => Promise<JourneySendResult<TContext, TStepId, TStepMeta>>;
  goToPreviousStep: (steps?: number) => Promise<JourneySendResult<TContext, TStepId, TStepMeta>>;
  goToLastVisitedStep: () => Promise<JourneySendResult<TContext, TStepId, TStepMeta>>;
  clearStepError: (stepId?: TStepId) => void;
  updateContext: (updater: (context: TContext) => TContext) => void;
  updateStepMetadata: (stepId: TStepId, updater: (metadata: TStepMeta) => TStepMeta) => void;
  resetJourney: () => void;
};

export type JourneyStoreValue<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
> = {
  machine: JourneyMachine<
    TContext,
    TStepId,
    JourneyEventType<TCustomEvent>,
    TEventPayloadMap,
    TStepMeta
  >;
  journey: JourneyReactDefinition<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>;
};

export type JourneyBindingsProviderProps<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
> = {
  journey?: JourneyReactDefinition<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>;
  machine?: JourneyMachine<
    TContext,
    TStepId,
    JourneyEventType<TCustomEvent>,
    TEventPayloadMap,
    TStepMeta
  >;
  persistence?: JourneyPersistenceOptions<TContext, TStepId, TStepMeta>;
  resetOnJourneyChange?: boolean;
  resetOnPersistenceChange?: boolean;
  onStart?: (
    event: Extract<
      JourneyObservationEvent<TStepId, JourneyEventType<TCustomEvent>, TEventPayloadMap, TStepMeta>,
      { type: "journey.start" }
    >
  ) => void;
  onComplete?: (
    event: Extract<
      JourneyObservationEvent<TStepId, JourneyEventType<TCustomEvent>, TEventPayloadMap, TStepMeta>,
      { type: "journey.complete" }
    >
  ) => void;
  onTerminate?: (
    event: Extract<
      JourneyObservationEvent<TStepId, JourneyEventType<TCustomEvent>, TEventPayloadMap, TStepMeta>,
      { type: "journey.close" }
    >
  ) => void;
  children: React.ReactNode;
};

export type JourneyBindings<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
> = {
  Provider: React.ComponentType<
    JourneyBindingsProviderProps<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>
  >;
  StepRenderer: React.ComponentType<{ fallback?: React.ReactNode }>;
  useJourneyApi: () => JourneyApi<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>;
  useJourneyMachine: () => JourneyMachine<
    TContext,
    TStepId,
    JourneyEventType<TCustomEvent>,
    TEventPayloadMap,
    TStepMeta
  >;
  useJourneyEvent: (
    listener: (
      event: JourneyObservationEvent<
        TStepId,
        JourneyEventType<TCustomEvent>,
        TEventPayloadMap,
        TStepMeta
      >
    ) => void
  ) => void;
  useJourneySelector: <TSelected>(
    selector: JourneySelector<TContext, TStepId, TStepMeta, TSelected>,
    equalityFn?: JourneyEqualityFn<TSelected>
  ) => TSelected;
  useJourneySnapshot: () => JourneySnapshot<TContext, TStepId, TStepMeta>;
};
