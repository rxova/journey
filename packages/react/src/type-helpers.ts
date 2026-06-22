import type {
  JourneyBaseEvent,
  JourneyBuilderCustomEventKey,
  JourneyBuilderDefinitionMetadata,
  JourneyDefinition,
  JourneyEqualityFn,
  JourneyJsonObject,
  JourneyMachineOptions,
  JourneyMachinePlugin,
  JourneySnapshot
} from "@rxova/journey-core";

export type SelectorCache<TContext extends JourneyJsonObject, TStepId extends string, TSelected> = {
  machine: unknown;
  snapshot: JourneySnapshot<TContext, TStepId>;
  selected: TSelected;
  selector: unknown;
  isEqual: JourneyEqualityFn<TSelected>;
};

export type JourneyOptionsInput<
  TPlugins extends readonly JourneyMachinePlugin[],
  THandlers extends Record<string, unknown> = Record<string, unknown>
> = JourneyMachineOptions<
  TPlugins extends [] ? readonly JourneyMachinePlugin[] : TPlugins,
  THandlers
>;

/** Extracts the `THandlers` parameter from a journey definition type, defaulting to a loose record. */
export type JourneyHandlersOfDefinition<TDefinition> =
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TDefinition extends JourneyDefinition<infer _TC, infer _TS, infer _TE, infer _TM, infer TH>
    ? TH
    : Record<string, unknown>;

export type JourneyCustomSendEventForKeys<
  TEvents extends JourneyBaseEvent,
  TAllowedEventType extends TEvents["type"]
> = Extract<TEvents, { type: TAllowedEventType }>;

type JourneyTransitionsFromDefinition<TDefinition> = TDefinition extends {
  transitions?: infer TTransitions;
}
  ? TTransitions
  : never;

type JourneyCustomEventKeysFromTransitionEntry<TEvents extends JourneyBaseEvent, TEntry> = Extract<
  keyof NonNullable<TEntry>,
  JourneyBuilderCustomEventKey<TEvents>
>;

type JourneyStepHandledCustomEventMapFromTransitions<
  TStepId extends string,
  TEvents extends JourneyBaseEvent,
  TTransitions
> = {
  [TCurrentStepId in TStepId]: JourneyCustomEventKeysFromTransitionEntry<
    TEvents,
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
  TEvents extends JourneyBaseEvent,
  TTransitions
> = JourneyCustomEventKeysFromTransitionEntry<
  TEvents,
  TTransitions extends readonly unknown[]
    ? never
    : TTransitions extends { global?: infer TGlobalTransitions }
      ? TGlobalTransitions
      : never
>;

export type JourneyStepHandledCustomEventMapFromDefinition<
  TDefinition,
  TStepId extends string,
  TEvents extends JourneyBaseEvent
> =
  TDefinition extends JourneyBuilderDefinitionMetadata<
    TStepId,
    TEvents,
    infer TStepHandledMap,
    infer TGlobalHandledCustomEventType
  >
    ? Extract<TStepHandledMap, Record<TStepId, JourneyBuilderCustomEventKey<TEvents>>> &
        (Extract<TGlobalHandledCustomEventType, JourneyBuilderCustomEventKey<TEvents>> extends never
          ? unknown
          : unknown)
    : JourneyStepHandledCustomEventMapFromTransitions<
        TStepId,
        TEvents,
        JourneyTransitionsFromDefinition<TDefinition>
      >;

export type JourneyGlobalHandledCustomEventTypeFromDefinition<
  TDefinition,
  TStepId extends string,
  TEvents extends JourneyBaseEvent
> =
  TDefinition extends JourneyBuilderDefinitionMetadata<
    TStepId,
    TEvents,
    Record<TStepId, JourneyBuilderCustomEventKey<TEvents>>,
    infer TGlobalHandledCustomEventType
  >
    ? Extract<TGlobalHandledCustomEventType, JourneyBuilderCustomEventKey<TEvents>>
    : JourneyGlobalHandledCustomEventTypeFromTransitions<
        TEvents,
        JourneyTransitionsFromDefinition<TDefinition>
      >;
