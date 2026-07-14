import type React from "react";

import type {
  JourneyBaseEvent,
  JourneyBuilderCustomEventKey,
  JourneyComputed,
  JourneyDefaultEventType,
  JourneyDefinition,
  JourneyEqualityFn,
  JourneyJsonObject,
  JourneyMachinePlugin,
  JourneyMachineWithPlugins,
  JourneyObservationEvent,
  JourneyPayloadFor,
  JourneySelector,
  JourneySendEvent,
  JourneySendResult,
  JourneySnapshot,
  JourneyStepAsyncState,
  LinearJourneyMachine
} from "@rxova/journey-core";
import type {
  JourneyCustomSendEventForKeys,
  JourneyGlobalHandledCustomEventTypeFromDefinition,
  JourneyStepHandledCustomEventMapFromDefinition
} from "./type-helpers";
import type { JourneyEmpty } from "@rxova/journey-core";

export type JourneyDefaultEvent = JourneyDefaultEventType;

export type JourneyViews<TStepId extends string> = Record<TStepId, React.ComponentType>;

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

export type JourneyProviderErrorContext = {
  phase: "start";
};

export type JourneyProviderProps<TStepId extends string> = {
  views: JourneyViews<TStepId>;
  onError?: (error: unknown, context: JourneyProviderErrorContext) => void;
  disposeOnUnmount?: boolean;
  children: React.ReactNode;
};

export type JourneyRuntime<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  TPlugins extends readonly JourneyMachinePlugin[] = [],
  THandlers extends Record<string, unknown> = JourneyEmpty
> = {
  machine: JourneyMachineWithPlugins<TContext, TStepId, TEvents, TStepMeta, THandlers, TPlugins>;
  dispose: () => void;
  useJourneySnapshot: () => JourneySnapshot<TContext, TStepId>;
  useJourneyComputed: () => JourneyComputed<TStepId>;
  useJourneySelector: <TSelected>(
    selector: JourneySelector<TContext, TStepId, TSelected>,
    equalityFn?: JourneyEqualityFn<TSelected>
  ) => TSelected;
  useStepAsyncState: (stepId: TStepId) => JourneyStepAsyncState;
  useJourneyApi: () => JourneyApi<TContext, TStepId, TEvents, TStepMeta>;
  useJourneyEvent: (listener: (event: JourneyObservationEvent<TStepId, TEvents>) => void) => void;
  useJourneyStepLifecycle: (
    stepId: TStepId,
    callbacks: {
      onEnter?: (args: { context: TContext }) => void;
      onLeave?: (args: { context: TContext }) => void;
    }
  ) => void;
  JourneyProvider: React.ComponentType<JourneyProviderProps<TStepId>>;
  StepRenderer: React.ComponentType<{ fallback?: React.ReactNode }>;
};

/** React runtime for a linear journey — `machine` carries `goToStepByIndex`. */
export type LinearJourneyRuntime<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TStepMeta = unknown,
  TPlugins extends readonly JourneyMachinePlugin[] = [],
  THandlers extends Record<string, unknown> = JourneyEmpty
> = Omit<JourneyRuntime<TContext, TStepId, never, TStepMeta, TPlugins, THandlers>, "machine"> & {
  machine: LinearJourneyMachine<TContext, TStepId, TStepMeta, THandlers, TPlugins>;
};

export type JourneyRuntimeWithStepApi<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  TPlugins extends readonly JourneyMachinePlugin[] = [],
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TStepHandledCustomEventMap extends Record<TStepId, JourneyBuilderCustomEventKey<TEvents>> =
    Record<TStepId, never>,
  TGlobalHandledCustomEventType extends JourneyBuilderCustomEventKey<TEvents> = never
> = JourneyRuntime<TContext, TStepId, TEvents, TStepMeta, TPlugins, THandlers> & {
  useStepApi: <TStepKey extends TStepId>(
    stepId: TStepKey
  ) => StepScopedJourneyApi<
    TContext,
    TStepId,
    TEvents,
    Extract<TStepHandledCustomEventMap[TStepKey] | TGlobalHandledCustomEventType, TEvents["type"]>,
    TStepMeta
  >;
};

export type JourneyBuilderRuntime<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  TPlugins extends readonly JourneyMachinePlugin[] = [],
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TStepHandledCustomEventMap extends Record<TStepId, JourneyBuilderCustomEventKey<TEvents>> =
    Record<TStepId, never>,
  TGlobalHandledCustomEventType extends JourneyBuilderCustomEventKey<TEvents> = never
> = JourneyRuntimeWithStepApi<
  TContext,
  TStepId,
  TEvents,
  TStepMeta,
  TPlugins,
  THandlers,
  TStepHandledCustomEventMap,
  TGlobalHandledCustomEventType
>;

export type JourneyBuilderRuntimeFactory<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  TPlugins extends readonly JourneyMachinePlugin[] = [],
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TStepHandledCustomEventMap extends Record<TStepId, JourneyBuilderCustomEventKey<TEvents>> =
    Record<TStepId, never>,
  TGlobalHandledCustomEventType extends JourneyBuilderCustomEventKey<TEvents> = never
> = () => JourneyBuilderRuntime<
  TContext,
  TStepId,
  TEvents,
  TStepMeta,
  TPlugins,
  THandlers,
  TStepHandledCustomEventMap,
  TGlobalHandledCustomEventType
>;

export type JourneyRuntimeFromDefinition<
  TDefinition,
  TPlugins extends readonly JourneyMachinePlugin[] = []
> =
  TDefinition extends JourneyDefinition<
    infer TContext,
    infer TStepId,
    infer TEvents,
    infer TStepMeta,
    infer THandlers
  >
    ? JourneyRuntimeWithStepApi<
        Extract<TContext, JourneyJsonObject>,
        Extract<TStepId, string>,
        Extract<TEvents, JourneyBaseEvent>,
        TStepMeta,
        TPlugins,
        Extract<THandlers, Record<string, unknown>>,
        JourneyStepHandledCustomEventMapFromDefinition<
          TDefinition,
          Extract<TStepId, string>,
          Extract<TEvents, JourneyBaseEvent>
        >,
        JourneyGlobalHandledCustomEventTypeFromDefinition<
          TDefinition,
          Extract<TStepId, string>,
          Extract<TEvents, JourneyBaseEvent>
        >
      >
    : never;

export type JourneyRuntimeFactoryFromDefinition<
  TDefinition,
  TPlugins extends readonly JourneyMachinePlugin[] = []
> = () => JourneyRuntimeFromDefinition<TDefinition, TPlugins>;

export type JourneyBuilderRuntimeFromDefinition<
  TDefinition,
  TPlugins extends readonly JourneyMachinePlugin[] = []
> = JourneyRuntimeFromDefinition<TDefinition, TPlugins>;

export type JourneyBuilderRuntimeFactoryFromDefinition<
  TDefinition,
  TPlugins extends readonly JourneyMachinePlugin[] = []
> = JourneyRuntimeFactoryFromDefinition<TDefinition, TPlugins>;

export type JourneyRuntimeFactory<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  TPlugins extends readonly JourneyMachinePlugin[] = [],
  THandlers extends Record<string, unknown> = JourneyEmpty
> = () => JourneyRuntime<TContext, TStepId, TEvents, TStepMeta, TPlugins, THandlers>;
