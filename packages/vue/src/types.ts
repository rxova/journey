import type { Component, ShallowRef, VNodeChild } from "vue";

import type {
  JourneyDefinition,
  JourneyEvent,
  JourneyEventPayloadMap as JourneyCoreEventPayloadMap,
  JourneyMachine,
  JourneyPayloadFor,
  JourneyPersistenceOptions,
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

export type JourneyVueEventPayloadMap<TCustomEvent extends string = never> =
  JourneyCoreEventPayloadMap<JourneyEventType<TCustomEvent>>;

export type JourneyVueStep<TStepMeta = unknown> = JourneyStepDefinition<TStepMeta> & {
  component: Component;
};

export type JourneyVueDefinition<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyVueEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
> = Omit<
  JourneyDefinition<TContext, TStepId, JourneyEventType<TCustomEvent>, TEventPayloadMap, TStepMeta>,
  "steps"
> & {
  steps: Record<TStepId, JourneyVueStep<TStepMeta>>;
};

export type JourneyApi<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyVueEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
> = {
  send: (
    event: JourneyEvent<TStepId, JourneyEventType<TCustomEvent>, TEventPayloadMap>
  ) => Promise<void>;
  goToNextStep: () => Promise<void>;
  terminateJourney: (
    payload?: JourneyPayloadFor<
      JourneyEventType<TCustomEvent>,
      TEventPayloadMap,
      "terminateJourney"
    >
  ) => Promise<void>;
  completeJourney: (
    payload?: JourneyPayloadFor<JourneyEventType<TCustomEvent>, TEventPayloadMap, "completeJourney">
  ) => Promise<void>;
  goToPreviousStep: (steps?: number) => Promise<void>;
  goToLastVisitedStep: () => Promise<void>;
  clearStepError: (stepId?: TStepId) => void;
  updateContext: (updater: (context: TContext) => TContext) => void;
  updateComponentMetadata: (stepId: TStepId, updater: (metadata: TStepMeta) => TStepMeta) => void;
  updateStepMetadata: (stepId: TStepId, updater: (metadata: TStepMeta) => TStepMeta) => void;
  resetJourney: () => void;
};

export type JourneyStoreValue<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyVueEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
> = {
  machine: JourneyMachine<
    TContext,
    TStepId,
    JourneyEventType<TCustomEvent>,
    TEventPayloadMap,
    TStepMeta
  >;
  journey: JourneyVueDefinition<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>;
};

export type JourneyBindingsProviderProps<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyVueEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
> = {
  journey?: JourneyVueDefinition<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>;
  machine?: JourneyMachine<
    TContext,
    TStepId,
    JourneyEventType<TCustomEvent>,
    TEventPayloadMap,
    TStepMeta
  >;
  persistence?: JourneyPersistenceOptions<TContext, TStepId, TStepMeta>;
  resetOnJourneyChange?: boolean;
};

export type JourneyBindings<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyVueEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
> = {
  Provider: Component;
  StepRenderer: Component<{ fallback?: VNodeChild }>;
  useJourneyApi: () => JourneyApi<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>;
  useJourneyMachine: () => JourneyMachine<
    TContext,
    TStepId,
    JourneyEventType<TCustomEvent>,
    TEventPayloadMap,
    TStepMeta
  >;
  useJourneySnapshot: () => ShallowRef<JourneySnapshot<TContext, TStepId, TStepMeta>>;
};
