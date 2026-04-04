import type React from "react";

import type {
  JourneyBuilderDefinitionMetadata,
  JourneyBuilderCustomEventKey,
  JourneyCompleteObservationEvent,
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
  JourneyStartObservationEvent,
  JourneyTerminateObservationEvent,
  JourneySnapshot
} from "@rxova/journey-core";

export type JourneyDefaultEvent = JourneyDefaultEventType;

export type JourneyViews<TStepId extends string> = Record<TStepId, React.ComponentType>;

type JourneyCustomSendEventForKeys<
  TEventMap extends Record<string, unknown>,
  TAllowedEventType extends keyof TEventMap & string
> = {
  [TCurrentEventType in TAllowedEventType]: {
    type: TCurrentEventType;
    payload?: JourneyPayloadFor<TEventMap, TCurrentEventType>;
  };
}[TAllowedEventType];

type JourneyTypeParam<TValue> = TValue extends unknown ? unknown : never;

type JourneyCompatEventAliasContext<
  TEventMap extends Record<string, unknown>,
  TStepMeta = unknown
> = (JourneyObservationEvent<string, TEventMap> extends never ? never : unknown) &
  JourneyTypeParam<TStepMeta>;

type JourneyTransitionsFromDefinition<TDefinition> = TDefinition extends {
  transitions?: infer TTransitions;
}
  ? TTransitions
  : never;

type JourneyCustomEventKeysFromTransitionEntry<
  TEventMap extends Record<string, unknown>,
  TEntry
> = Extract<keyof NonNullable<TEntry>, JourneyBuilderCustomEventKey<TEventMap>>;

type JourneyStepHandledCustomEventMapFromTransitions<
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TTransitions
> = {
  [TCurrentStepId in TStepId]: JourneyCustomEventKeysFromTransitionEntry<
    TEventMap,
    TTransitions extends readonly unknown[]
      ? never
      : TTransitions extends Record<string, unknown>
        ? TCurrentStepId extends keyof TTransitions
          ? TTransitions[TCurrentStepId]
          : never
        : never
  >;
};

type JourneyGlobalHandledCustomEventTypeFromTransitions<
  TEventMap extends Record<string, unknown>,
  TTransitions
> = JourneyCustomEventKeysFromTransitionEntry<
  TEventMap,
  TTransitions extends readonly unknown[]
    ? never
    : TTransitions extends { global?: infer TGlobalTransitions }
      ? TGlobalTransitions
      : never
>;

type JourneyStepHandledCustomEventMapFromDefinition<
  TDefinition,
  TStepId extends string,
  TEventMap extends Record<string, unknown>
> =
  TDefinition extends JourneyBuilderDefinitionMetadata<
    TStepId,
    TEventMap,
    infer TStepHandledMap,
    infer TGlobalHandledCustomEventType
  >
    ? Extract<TStepHandledMap, Record<TStepId, JourneyBuilderCustomEventKey<TEventMap>>> &
        (Extract<
          TGlobalHandledCustomEventType,
          JourneyBuilderCustomEventKey<TEventMap>
        > extends never
          ? unknown
          : unknown)
    : JourneyStepHandledCustomEventMapFromTransitions<
        TStepId,
        TEventMap,
        JourneyTransitionsFromDefinition<TDefinition>
      >;

type JourneyGlobalHandledCustomEventTypeFromDefinition<
  TDefinition,
  TStepId extends string,
  TEventMap extends Record<string, unknown>
> =
  TDefinition extends JourneyBuilderDefinitionMetadata<
    TStepId,
    TEventMap,
    Record<TStepId, JourneyBuilderCustomEventKey<TEventMap>>,
    infer TGlobalHandledCustomEventType
  >
    ? Extract<TGlobalHandledCustomEventType, JourneyBuilderCustomEventKey<TEventMap>>
    : JourneyGlobalHandledCustomEventTypeFromTransitions<
        TEventMap,
        JourneyTransitionsFromDefinition<TDefinition>
      >;

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

export type StepScopedJourneyApi<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TAllowedEventType extends keyof TEventMap & string = never,
  TStepMeta = unknown
> = Omit<JourneyApi<TContext, TStepId, TEventMap, TStepMeta>, "send"> & {
  send: (
    event: JourneyCustomSendEventForKeys<TEventMap, TAllowedEventType>
  ) => Promise<JourneySendResult<TContext, TStepId>>;
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

export type JourneyRuntimeWithStepApi<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  TPlugins extends readonly JourneyMachinePlugin[] = [],
  THandlers extends Record<string, unknown> = Record<never, never>,
  TStepHandledCustomEventMap extends Record<TStepId, JourneyBuilderCustomEventKey<TEventMap>> =
    Record<TStepId, never>,
  TGlobalHandledCustomEventType extends JourneyBuilderCustomEventKey<TEventMap> = never
> = JourneyRuntime<TContext, TStepId, TEventMap, TStepMeta, TPlugins, THandlers> & {
  useStepApi: <TStepKey extends TStepId>(
    stepId: TStepKey
  ) => StepScopedJourneyApi<
    TContext,
    TStepId,
    TEventMap,
    Extract<
      TStepHandledCustomEventMap[TStepKey] | TGlobalHandledCustomEventType,
      keyof TEventMap & string
    >,
    TStepMeta
  >;
};

export type JourneyBuilderRuntime<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  TPlugins extends readonly JourneyMachinePlugin[] = [],
  THandlers extends Record<string, unknown> = Record<never, never>,
  TStepHandledCustomEventMap extends Record<TStepId, JourneyBuilderCustomEventKey<TEventMap>> =
    Record<TStepId, never>,
  TGlobalHandledCustomEventType extends JourneyBuilderCustomEventKey<TEventMap> = never
> = JourneyRuntimeWithStepApi<
  TContext,
  TStepId,
  TEventMap,
  TStepMeta,
  TPlugins,
  THandlers,
  TStepHandledCustomEventMap,
  TGlobalHandledCustomEventType
>;

export type JourneyBuilderRuntimeFactory<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  TPlugins extends readonly JourneyMachinePlugin[] = [],
  THandlers extends Record<string, unknown> = Record<never, never>,
  TStepHandledCustomEventMap extends Record<TStepId, JourneyBuilderCustomEventKey<TEventMap>> =
    Record<TStepId, never>,
  TGlobalHandledCustomEventType extends JourneyBuilderCustomEventKey<TEventMap> = never
> = () => JourneyBuilderRuntime<
  TContext,
  TStepId,
  TEventMap,
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
    infer TEventMap,
    infer TStepMeta,
    infer THandlers
  >
    ? JourneyRuntimeWithStepApi<
        Extract<TContext, JourneyJsonObject>,
        Extract<TStepId, string>,
        Extract<TEventMap, Record<string, unknown>>,
        TStepMeta,
        TPlugins,
        Extract<THandlers, Record<string, unknown>>,
        JourneyStepHandledCustomEventMapFromDefinition<
          TDefinition,
          Extract<TStepId, string>,
          Extract<TEventMap, Record<string, unknown>>
        >,
        JourneyGlobalHandledCustomEventTypeFromDefinition<
          TDefinition,
          Extract<TStepId, string>,
          Extract<TEventMap, Record<string, unknown>>
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
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  TPlugins extends readonly JourneyMachinePlugin[] = [],
  THandlers extends Record<string, unknown> = Record<never, never>
> = () => JourneyRuntime<TContext, TStepId, TEventMap, TStepMeta, TPlugins, THandlers>;
