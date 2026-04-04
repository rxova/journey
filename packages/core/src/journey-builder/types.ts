import type {
  JourneyDefaultEventType,
  JourneyDefinition,
  JourneyFullEventType,
  JourneyJsonObject
} from "../types";
import type {
  JourneyStepLifecycleCallback,
  JourneyTransitionArgsForEvent,
  JourneyTransitionUpdateContextArgsForEvent
} from "../types";

export type JourneyBuilderStepEventKey<TEventMap extends Record<string, unknown>> = Exclude<
  JourneyFullEventType<TEventMap>,
  "completeJourney" | "terminateJourney"
>;

export type JourneyBuilderTerminalEventKey<TEventMap extends Record<string, unknown>> = Extract<
  JourneyFullEventType<TEventMap>,
  "completeJourney" | "terminateJourney"
>;

export type JourneyBuilderCustomEventKey<TEventMap extends Record<string, unknown>> = Exclude<
  keyof TEventMap & string,
  JourneyDefaultEventType
>;

export type JourneyBuilderGuard<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>,
  TEventType extends JourneyFullEventType<TEventMap> = JourneyFullEventType<TEventMap>
> = (
  args: JourneyTransitionArgsForEvent<TContext, TStepId, TEventMap, THandlers, TEventType>
) => boolean | Promise<boolean>;

export type JourneyBuilderUpdateContext<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TEventType extends JourneyFullEventType<TEventMap> = JourneyFullEventType<TEventMap>
> = (
  args: JourneyTransitionUpdateContextArgsForEvent<TContext, TStepId, TEventMap, TEventType>
) => TContext;

export type JourneyBuilderLifecycle<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>
> = JourneyStepLifecycleCallback<TContext, TStepId, TEventMap, THandlers>;

export type JourneyBuilderCandidate<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>,
  TEventType extends JourneyFullEventType<TEventMap> = JourneyFullEventType<TEventMap>
> = {
  readonly _to: TStepId;
  readonly _when:
    | JourneyBuilderGuard<TContext, TStepId, TEventMap, THandlers, TEventType>
    | undefined;
  readonly _updateContext:
    | JourneyBuilderUpdateContext<TContext, TStepId, TEventMap, TEventType>
    | undefined;
  readonly _onEnter: JourneyBuilderLifecycle<TContext, TStepId, TEventMap, THandlers> | undefined;
  readonly _onLeave: JourneyBuilderLifecycle<TContext, TStepId, TEventMap, THandlers> | undefined;
  readonly _id: string | undefined;
  readonly _timeoutMs: number | undefined;
};

export type JourneyToBuilderUsage = {
  readonly when: boolean;
  readonly updateContext: boolean;
  readonly onEnter: boolean;
  readonly onLeave: boolean;
  readonly id: boolean;
  readonly timeoutMs: boolean;
};

export type JourneyToBuilderUnused = {
  readonly when: false;
  readonly updateContext: false;
  readonly onEnter: false;
  readonly onLeave: false;
  readonly id: false;
  readonly timeoutMs: false;
};

type JourneyDuplicateModifierCall<TName extends string> = (
  ...args: [
    `Duplicate transition modifier ${TName}() is invalid. If several are present, the last one wins at runtime.`
  ]
) => never;

export type JourneyToBuilder<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>,
  TEventType extends JourneyFullEventType<TEventMap> = JourneyFullEventType<TEventMap>,
  TUsed extends JourneyToBuilderUsage = JourneyToBuilderUnused
> = {
  readonly _candidate: JourneyBuilderCandidate<TContext, TStepId, TEventMap, THandlers, TEventType>;
  when: TUsed["when"] extends true
    ? JourneyDuplicateModifierCall<"when">
    : (
        guard: JourneyBuilderGuard<TContext, TStepId, TEventMap, THandlers, TEventType>
      ) => JourneyToBuilder<
        TContext,
        TStepId,
        TEventMap,
        THandlers,
        TEventType,
        Omit<TUsed, "when"> & { readonly when: true }
      >;
  updateContext: TUsed["updateContext"] extends true
    ? JourneyDuplicateModifierCall<"updateContext">
    : (
        fn: JourneyBuilderUpdateContext<TContext, TStepId, TEventMap, TEventType>
      ) => JourneyToBuilder<
        TContext,
        TStepId,
        TEventMap,
        THandlers,
        TEventType,
        Omit<TUsed, "updateContext"> & { readonly updateContext: true }
      >;
  onEnter: TUsed["onEnter"] extends true
    ? JourneyDuplicateModifierCall<"onEnter">
    : (
        fn: JourneyBuilderLifecycle<TContext, TStepId, TEventMap, THandlers>
      ) => JourneyToBuilder<
        TContext,
        TStepId,
        TEventMap,
        THandlers,
        TEventType,
        Omit<TUsed, "onEnter"> & { readonly onEnter: true }
      >;
  onLeave: TUsed["onLeave"] extends true
    ? JourneyDuplicateModifierCall<"onLeave">
    : (
        fn: JourneyBuilderLifecycle<TContext, TStepId, TEventMap, THandlers>
      ) => JourneyToBuilder<
        TContext,
        TStepId,
        TEventMap,
        THandlers,
        TEventType,
        Omit<TUsed, "onLeave"> & { readonly onLeave: true }
      >;
  id: TUsed["id"] extends true
    ? JourneyDuplicateModifierCall<"id">
    : (
        id: string
      ) => JourneyToBuilder<
        TContext,
        TStepId,
        TEventMap,
        THandlers,
        TEventType,
        Omit<TUsed, "id"> & { readonly id: true }
      >;
  timeoutMs: TUsed["timeoutMs"] extends true
    ? JourneyDuplicateModifierCall<"timeoutMs">
    : (
        ms: number
      ) => JourneyToBuilder<
        TContext,
        TStepId,
        TEventMap,
        THandlers,
        TEventType,
        Omit<TUsed, "timeoutMs"> & { readonly timeoutMs: true }
      >;
};

type JourneyBuiltTransitionCandidate<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>,
  TEventType extends JourneyFullEventType<TEventMap> = JourneyFullEventType<TEventMap>
> = {
  readonly _candidate: JourneyBuilderCandidate<TContext, TStepId, TEventMap, THandlers, TEventType>;
};

export type JourneyBuilderOnEntry<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>,
  TEventType extends JourneyBuilderStepEventKey<TEventMap>
> =
  | readonly JourneyBuiltTransitionCandidate<TContext, TStepId, TEventMap, THandlers>[]
  | ((helpers: {
      to: (
        stepId: TStepId
      ) => JourneyToBuilder<TContext, TStepId, TEventMap, THandlers, TEventType>;
    }) => readonly JourneyBuiltTransitionCandidate<
      TContext,
      TStepId,
      TEventMap,
      THandlers,
      TEventType
    >[]);

export type JourneyBuilderTerminalCandidate<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>,
  TEventType extends JourneyBuilderTerminalEventKey<TEventMap>
> = {
  when?: JourneyBuilderGuard<TContext, TStepId, TEventMap, THandlers, TEventType>;
  updateContext?: JourneyBuilderUpdateContext<TContext, TStepId, TEventMap, TEventType>;
  onEnter?: JourneyBuilderLifecycle<TContext, TStepId, TEventMap, THandlers>;
  onLeave?: JourneyBuilderLifecycle<TContext, TStepId, TEventMap, THandlers>;
  id?: string;
  timeoutMs?: number;
};

export type JourneyBuilderTerminalEntry<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>,
  TEventType extends JourneyBuilderTerminalEventKey<TEventMap>
> =
  | true
  | readonly []
  | readonly JourneyBuilderTerminalCandidate<TContext, TStepId, TEventMap, THandlers, TEventType>[];

type JourneyBuilderEventEntry<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>,
  TEventType extends JourneyFullEventType<TEventMap>
> =
  TEventType extends JourneyBuilderTerminalEventKey<TEventMap>
    ? JourneyBuilderTerminalEntry<TContext, TStepId, TEventMap, THandlers, TEventType>
    : JourneyBuilderOnEntry<
        TContext,
        TStepId,
        TEventMap,
        THandlers,
        Extract<TEventType, JourneyBuilderStepEventKey<TEventMap>>
      >;

type JourneyStepBuilderOnConfig<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>
> = Partial<{
  [TEventType in JourneyFullEventType<TEventMap>]: JourneyBuilderEventEntry<
    TContext,
    TStepId,
    TEventMap,
    THandlers,
    TEventType
  >;
}>;

type JourneyStepBuilderHandledCustomEventKey<
  TEventMap extends Record<string, unknown>,
  TOn
> = Extract<keyof NonNullable<TOn>, JourneyBuilderCustomEventKey<TEventMap>>;

type JourneyStepBuilderConfig<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta,
  THandlers extends Record<string, unknown>,
  TOn extends JourneyStepBuilderOnConfig<TContext, TStepId, TEventMap, THandlers> | undefined =
    | JourneyStepBuilderOnConfig<TContext, TStepId, TEventMap, THandlers>
    | undefined
> = {
  meta?: TStepMeta;
  onEnter?: JourneyStepLifecycleCallback<TContext, TStepId, TEventMap, THandlers>;
  onLeave?: JourneyStepLifecycleCallback<TContext, TStepId, TEventMap, THandlers>;
  on?: TOn;
};

export type JourneyStepBuilder<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TStepKey extends TStepId,
  TEventMap extends Record<string, unknown>,
  TStepMeta,
  THandlers extends Record<string, unknown>,
  THandledCustomEventType extends JourneyBuilderCustomEventKey<TEventMap> = never
> = {
  readonly id: TStepKey;
  readonly _meta: TStepMeta | undefined;
  readonly _onEnter:
    | JourneyStepLifecycleCallback<TContext, TStepId, TEventMap, THandlers>
    | undefined;
  readonly _onLeave:
    | JourneyStepLifecycleCallback<TContext, TStepId, TEventMap, THandlers>
    | undefined;
  readonly _on:
    | Record<
        string,
        JourneyBuilderEventEntry<
          TContext,
          TStepId,
          TEventMap,
          THandlers,
          JourneyFullEventType<TEventMap>
        >
      >
    | undefined;
  readonly _handledCustomEventType?: THandledCustomEventType;
};

type JourneyStepBuilderHandledCustomEventMap<
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TSteps extends readonly {
    readonly id: TStepId;
    readonly _handledCustomEventType?: JourneyBuilderCustomEventKey<TEventMap>;
  }[]
> = {
  [TCurrentStepId in TStepId]: Extract<
    Extract<TSteps[number], { readonly id: TCurrentStepId }> extends {
      readonly _handledCustomEventType?: infer THandledCustomEventType;
    }
      ? THandledCustomEventType
      : never,
    JourneyBuilderCustomEventKey<TEventMap>
  >;
};

type JourneyBuilderGlobalHandledCustomEventKey<
  TEventMap extends Record<string, unknown>,
  TGlobal
> = Extract<keyof NonNullable<TGlobal>, JourneyBuilderCustomEventKey<TEventMap>>;

declare const journeyBuilderDefinitionBrand: unique symbol;

export type JourneyBuilderDefinitionMetadata<
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepHandledCustomEventMap extends Record<TStepId, JourneyBuilderCustomEventKey<TEventMap>> =
    Record<TStepId, never>,
  TGlobalHandledCustomEventType extends JourneyBuilderCustomEventKey<TEventMap> = never
> = {
  readonly [journeyBuilderDefinitionBrand]?: {
    readonly stepHandledCustomEvents: TStepHandledCustomEventMap;
    readonly globalHandledCustomEvents: TGlobalHandledCustomEventType;
  };
};

export type JourneyBuilderDefinition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>,
  TStepHandledCustomEventMap extends Record<TStepId, JourneyBuilderCustomEventKey<TEventMap>> =
    Record<TStepId, never>,
  TGlobalHandledCustomEventType extends JourneyBuilderCustomEventKey<TEventMap> = never
> = JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers> &
  JourneyBuilderDefinitionMetadata<
    TStepId,
    TEventMap,
    TStepHandledCustomEventMap,
    TGlobalHandledCustomEventType
  >;

type JourneyBuilderGlobalConfig<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>
> = Partial<{
  [TEventType in JourneyFullEventType<TEventMap>]: TEventType extends JourneyBuilderTerminalEventKey<TEventMap>
    ? JourneyBuilderTerminalEntry<TContext, TStepId, TEventMap, THandlers, TEventType>
    : readonly JourneyBuiltTransitionCandidate<TContext, TStepId, TEventMap, THandlers>[];
}>;

type JourneyBuilderBuildInput<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta,
  THandlers extends Record<string, unknown>,
  TSteps extends readonly JourneyStepBuilder<
    TContext,
    TStepId,
    TStepId,
    TEventMap,
    TStepMeta,
    THandlers,
    JourneyBuilderCustomEventKey<TEventMap>
  >[],
  TGlobal extends JourneyBuilderGlobalConfig<TContext, TStepId, TEventMap, THandlers> | undefined =
    | JourneyBuilderGlobalConfig<TContext, TStepId, TEventMap, THandlers>
    | undefined
> = {
  initial: TStepId;
  context: TContext;
  handlers?: THandlers;
  steps: TSteps;
  global?: TGlobal;
};

export type JourneyBuilder<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>
> = {
  createStep: <
    TStepKey extends TStepId,
    TOn extends JourneyStepBuilderOnConfig<TContext, TStepId, TEventMap, THandlers> | undefined =
      | JourneyStepBuilderOnConfig<TContext, TStepId, TEventMap, THandlers>
      | undefined
  >(
    id: TStepKey,
    config?: JourneyStepBuilderConfig<TContext, TStepId, TEventMap, TStepMeta, THandlers, TOn>
  ) => JourneyStepBuilder<
    TContext,
    TStepId,
    TStepKey,
    TEventMap,
    TStepMeta,
    THandlers,
    JourneyStepBuilderHandledCustomEventKey<TEventMap, TOn>
  >;
  to: (stepId: TStepId) => JourneyToBuilder<TContext, TStepId, TEventMap, THandlers>;
  build: <
    TSteps extends readonly JourneyStepBuilder<
      TContext,
      TStepId,
      TStepId,
      TEventMap,
      TStepMeta,
      THandlers,
      JourneyBuilderCustomEventKey<TEventMap>
    >[],
    TGlobal extends
      | JourneyBuilderGlobalConfig<TContext, TStepId, TEventMap, THandlers>
      | undefined = JourneyBuilderGlobalConfig<TContext, TStepId, TEventMap, THandlers> | undefined
  >(
    input: JourneyBuilderBuildInput<
      TContext,
      TStepId,
      TEventMap,
      TStepMeta,
      THandlers,
      TSteps,
      TGlobal
    >
  ) => JourneyBuilderDefinition<
    TContext,
    TStepId,
    TEventMap,
    TStepMeta,
    THandlers,
    JourneyStepBuilderHandledCustomEventMap<TStepId, TEventMap, TSteps>,
    JourneyBuilderGlobalHandledCustomEventKey<TEventMap, TGlobal>
  >;
};

export type {
  JourneyStepBuilderConfig as _JourneyStepBuilderConfig,
  JourneyBuilderBuildInput as _JourneyBuilderBuildInput,
  JourneyBuilderEventEntry as _JourneyBuilderEventEntry
};
