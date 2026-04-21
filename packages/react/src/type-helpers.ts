import type {
  JourneyBuilderCustomEventKey,
  JourneyBuilderDefinitionMetadata,
  JourneyEqualityFn,
  JourneyJsonObject,
  JourneyMachineOptions,
  JourneyMachinePlugin,
  JourneyPayloadFor,
  JourneySnapshot
} from "@rxova/journey-core";

export type SelectorCache<TContext extends JourneyJsonObject, TStepId extends string, TSelected> = {
  machine: unknown;
  snapshot: JourneySnapshot<TContext, TStepId>;
  selected: TSelected;
  selector: unknown;
  isEqual: JourneyEqualityFn<TSelected>;
};

export type JourneyOptionsInput<TPlugins extends readonly JourneyMachinePlugin[]> =
  JourneyMachineOptions<TPlugins extends [] ? readonly JourneyMachinePlugin[] : TPlugins>;

export type JourneyCustomSendEventForKeys<
  TEventMap extends Record<string, unknown>,
  TAllowedEventType extends keyof TEventMap & string
> = {
  [TCurrentEventType in TAllowedEventType]: {
    type: TCurrentEventType;
    payload?: JourneyPayloadFor<TEventMap, TCurrentEventType>;
  };
}[TAllowedEventType];

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

export type JourneyStepHandledCustomEventMapFromDefinition<
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

export type JourneyGlobalHandledCustomEventTypeFromDefinition<
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
