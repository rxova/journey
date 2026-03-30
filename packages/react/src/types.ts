import type React from "react";

import type {
  JourneyCompleteObservationEvent,
  JourneyComputed,
  JourneyDefaultEventType,
  JourneyEqualityFn,
  JourneyJsonObject,
  JourneyMachinePlugin,
  JourneyMachineWithPlugins,
  JourneyObservationEvent,
  JourneyPayloadFor,
  JourneySelector,
  JourneySendEvent,
  JourneySendResult,
  JourneyStartObservationEvent,
  JourneyTerminateObservationEvent,
  JourneySnapshot
} from "@rxova/journey-core";

export type JourneyDefaultEvent = JourneyDefaultEventType;

export type JourneyViews<TStepId extends string> = Record<TStepId, React.ComponentType>;

type JourneyTypeParam<TValue> = TValue extends unknown ? unknown : never;

type JourneyCompatEventAliasContext<
  TEventMap extends Record<string, unknown>,
  TStepMeta = unknown
> = (JourneyObservationEvent<string, TEventMap> extends never ? never : unknown) &
  JourneyTypeParam<TStepMeta>;

export type JourneyApi<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown
> = {
  start: () => Promise<JourneySnapshot<TContext, TStepId>>;
  send: (
    event: JourneySendEvent<TStepId, TEventMap>
  ) => Promise<JourneySendResult<TContext, TStepId>>;
  goToNextStep: () => Promise<JourneySendResult<TContext, TStepId>>;
  goToStepById: (stepId: TStepId) => Promise<JourneySendResult<TContext, TStepId>>;
  terminateJourney: (
    payload?: JourneyPayloadFor<TEventMap, "terminateJourney">
  ) => Promise<JourneySendResult<TContext, TStepId>>;
  completeJourney: (
    payload?: JourneyPayloadFor<TEventMap, "completeJourney">
  ) => Promise<JourneySendResult<TContext, TStepId>>;
  goToPreviousStep: (steps?: number) => Promise<JourneySendResult<TContext, TStepId>>;
  goToLastVisitedStep: () => Promise<JourneySendResult<TContext, TStepId>>;
  clearStepError: (stepId?: TStepId) => Promise<JourneySnapshot<TContext, TStepId>>;
  updateContext: (
    updater: (context: TContext) => TContext
  ) => Promise<JourneySnapshot<TContext, TStepId>>;
  getStepMeta: (stepId: TStepId) => TStepMeta | undefined;
  resetJourney: () => Promise<JourneySnapshot<TContext, TStepId>>;
};

export type JourneyStartEvent<
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown
> = JourneyStartObservationEvent<TStepId> & JourneyCompatEventAliasContext<TEventMap, TStepMeta>;

export type JourneyCompleteEvent<
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown
> = JourneyCompleteObservationEvent<TStepId> & JourneyCompatEventAliasContext<TEventMap, TStepMeta>;

export type JourneyTerminateEvent<
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown
> = JourneyTerminateObservationEvent<TStepId> &
  JourneyCompatEventAliasContext<TEventMap, TStepMeta>;

export type JourneyProviderErrorContext = {
  phase: "start";
};

export type JourneyProviderProps<
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown
> = {
  views: JourneyViews<TStepId>;
  onStart?: (event: JourneyStartEvent<TStepId, TEventMap, TStepMeta>) => void;
  onComplete?: (event: JourneyCompleteEvent<TStepId, TEventMap, TStepMeta>) => void;
  onTerminate?: (event: JourneyTerminateEvent<TStepId, TEventMap, TStepMeta>) => void;
  onError?: (error: unknown, context: JourneyProviderErrorContext) => void;
  disposeOnUnmount?: boolean;
  children: React.ReactNode;
};

export type JourneyRuntime<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  TPlugins extends readonly JourneyMachinePlugin[] = [],
  THandlers extends Record<string, unknown> = Record<never, never>
> = {
  machine: JourneyMachineWithPlugins<TContext, TStepId, TEventMap, TStepMeta, THandlers, TPlugins>;
  dispose: () => void;
  useJourneySnapshot: () => JourneySnapshot<TContext, TStepId>;
  useJourneyComputed: () => JourneyComputed<TStepId>;
  useJourneySelector: <TSelected>(
    selector: JourneySelector<TContext, TStepId, TSelected>,
    equalityFn?: JourneyEqualityFn<TSelected>
  ) => TSelected;
  useJourneyApi: () => JourneyApi<TContext, TStepId, TEventMap, TStepMeta>;
  useJourneyEvent: (listener: (event: JourneyObservationEvent<TStepId, TEventMap>) => void) => void;
  useJourneyStepLifecycle: (
    stepId: TStepId,
    callbacks: {
      onEnter?: (args: { context: TContext }) => void;
      onLeave?: (args: { context: TContext }) => void;
    }
  ) => void;
  JourneyProvider: React.ComponentType<JourneyProviderProps<TStepId, TEventMap, TStepMeta>>;
  StepRenderer: React.ComponentType<{ fallback?: React.ReactNode }>;
};

export type JourneyRuntimeFactory<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  TPlugins extends readonly JourneyMachinePlugin[] = [],
  THandlers extends Record<string, unknown> = Record<never, never>
> = () => JourneyRuntime<TContext, TStepId, TEventMap, TStepMeta, TPlugins, THandlers>;
