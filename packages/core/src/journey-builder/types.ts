import type {
  JourneyDefaultEventType,
  JourneyDefinition,
  JourneyFullEventType,
  JourneyTypes
} from "../types";
import type {
  JourneyAfterTransition,
  JourneyStepEffect,
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
  T extends JourneyTypes,
  TEventType extends JourneyFullEventType<T["events"]> = JourneyFullEventType<T["events"]>
> = (
  args: JourneyTransitionArgsForEvent<
    T["context"],
    T["stepId"],
    T["events"],
    T["handlers"],
    TEventType
  >
) => boolean | Promise<boolean>;

export type JourneyBuilderUpdateContext<
  T extends JourneyTypes,
  TEventType extends JourneyFullEventType<T["events"]> = JourneyFullEventType<T["events"]>
> = (
  args: JourneyTransitionUpdateContextArgsForEvent<
    T["context"],
    T["stepId"],
    T["events"],
    TEventType
  >
) => T["context"];

export type JourneyBuilderLifecycle<T extends JourneyTypes> = JourneyStepLifecycleCallback<
  T["context"],
  T["stepId"],
  T["events"],
  T["handlers"]
>;

export type JourneyBuilderCandidate<
  T extends JourneyTypes,
  TEventType extends JourneyFullEventType<T["events"]> = JourneyFullEventType<T["events"]>
> = {
  readonly _to: T["stepId"];
  readonly _when: JourneyBuilderGuard<T, TEventType> | undefined;
  readonly _updateContext: JourneyBuilderUpdateContext<T, TEventType> | undefined;
  readonly _onEnter: JourneyBuilderLifecycle<T> | undefined;
  readonly _onLeave: JourneyBuilderLifecycle<T> | undefined;
  readonly _label: string | undefined;
  readonly _timeoutMs: number | undefined;
};

export type JourneyToBuilderUsage = {
  readonly when: boolean;
  readonly updateContext: boolean;
  readonly onEnter: boolean;
  readonly onLeave: boolean;
  readonly label: boolean;
  readonly timeoutMs: boolean;
};

export type JourneyToBuilderUnused = {
  readonly when: false;
  readonly updateContext: false;
  readonly onEnter: false;
  readonly onLeave: false;
  readonly label: false;
  readonly timeoutMs: false;
};

type JourneyDuplicateModifierCall<TName extends string> = (
  ...args: [
    `Duplicate transition modifier ${TName}() is invalid. If several are present, the last one wins at runtime.`
  ]
) => never;

export type JourneyToBuilder<
  T extends JourneyTypes,
  TEventType extends JourneyFullEventType<T["events"]> = JourneyFullEventType<T["events"]>,
  TUsed extends JourneyToBuilderUsage = JourneyToBuilderUnused
> = {
  readonly _candidate: JourneyBuilderCandidate<T, TEventType>;
  when: TUsed["when"] extends true
    ? JourneyDuplicateModifierCall<"when">
    : (
        guard: JourneyBuilderGuard<T, TEventType>
      ) => JourneyToBuilder<T, TEventType, Omit<TUsed, "when"> & { readonly when: true }>;
  updateContext: TUsed["updateContext"] extends true
    ? JourneyDuplicateModifierCall<"updateContext">
    : (
        fn: JourneyBuilderUpdateContext<T, TEventType>
      ) => JourneyToBuilder<
        T,
        TEventType,
        Omit<TUsed, "updateContext"> & { readonly updateContext: true }
      >;
  onEnter: TUsed["onEnter"] extends true
    ? JourneyDuplicateModifierCall<"onEnter">
    : (
        fn: JourneyBuilderLifecycle<T>
      ) => JourneyToBuilder<T, TEventType, Omit<TUsed, "onEnter"> & { readonly onEnter: true }>;
  onLeave: TUsed["onLeave"] extends true
    ? JourneyDuplicateModifierCall<"onLeave">
    : (
        fn: JourneyBuilderLifecycle<T>
      ) => JourneyToBuilder<T, TEventType, Omit<TUsed, "onLeave"> & { readonly onLeave: true }>;
  label: TUsed["label"] extends true
    ? JourneyDuplicateModifierCall<"label">
    : (
        label: string
      ) => JourneyToBuilder<T, TEventType, Omit<TUsed, "label"> & { readonly label: true }>;
  timeoutMs: TUsed["timeoutMs"] extends true
    ? JourneyDuplicateModifierCall<"timeoutMs">
    : (
        ms: number
      ) => JourneyToBuilder<T, TEventType, Omit<TUsed, "timeoutMs"> & { readonly timeoutMs: true }>;
};

type JourneyBuiltTransitionCandidate<
  T extends JourneyTypes,
  TEventType extends JourneyFullEventType<T["events"]> = JourneyFullEventType<T["events"]>
> = {
  readonly _candidate: JourneyBuilderCandidate<T, TEventType>;
};

export type JourneyBuilderOnEntry<
  T extends JourneyTypes,
  TEventType extends JourneyBuilderStepEventKey<T["events"]>
> =
  | readonly JourneyBuiltTransitionCandidate<T>[]
  | ((helpers: {
      to: (stepId: T["stepId"]) => JourneyToBuilder<T, TEventType>;
    }) => readonly JourneyBuiltTransitionCandidate<T, TEventType>[]);

export type JourneyBuilderTerminalCandidate<
  T extends JourneyTypes,
  TEventType extends JourneyBuilderTerminalEventKey<T["events"]>
> = {
  when?: JourneyBuilderGuard<T, TEventType>;
  updateContext?: JourneyBuilderUpdateContext<T, TEventType>;
  onEnter?: JourneyBuilderLifecycle<T>;
  onLeave?: JourneyBuilderLifecycle<T>;
  label?: string;
  timeoutMs?: number;
};

export type JourneyBuilderTerminalEntry<
  T extends JourneyTypes,
  TEventType extends JourneyBuilderTerminalEventKey<T["events"]>
> = true | readonly [] | readonly JourneyBuilderTerminalCandidate<T, TEventType>[];

type JourneyBuilderEventEntry<
  T extends JourneyTypes,
  TEventType extends JourneyFullEventType<T["events"]>
> =
  TEventType extends JourneyBuilderTerminalEventKey<T["events"]>
    ? JourneyBuilderTerminalEntry<T, TEventType>
    : JourneyBuilderOnEntry<T, Extract<TEventType, JourneyBuilderStepEventKey<T["events"]>>>;

type JourneyStepBuilderOnConfig<T extends JourneyTypes> = Partial<{
  [TEventType in JourneyFullEventType<T["events"]>]: JourneyBuilderEventEntry<T, TEventType>;
}>;

type JourneyStepBuilderHandledCustomEventKey<
  TEventMap extends Record<string, unknown>,
  TOn
> = Extract<keyof NonNullable<TOn>, JourneyBuilderCustomEventKey<TEventMap>>;

type JourneyStepBuilderConfig<
  T extends JourneyTypes,
  TOn extends JourneyStepBuilderOnConfig<T> | undefined = JourneyStepBuilderOnConfig<T> | undefined,
  TEffectOutput = unknown
> = {
  meta?: T["meta"];
  onEnter?: JourneyStepLifecycleCallback<T["context"], T["stepId"], T["events"], T["handlers"]>;
  onLeave?: JourneyStepLifecycleCallback<T["context"], T["stepId"], T["events"], T["handlers"]>;
  on?: TOn;
  /** Declarative async work run on entry; `output` is inferred from `run`. */
  effect?: JourneyStepEffect<T["context"], T["stepId"], T["handlers"], TEffectOutput>;
  /** Delayed transitions keyed by milliseconds. */
  after?: Record<number, JourneyAfterTransition<T["context"], T["stepId"]>>;
};

export type JourneyStepBuilder<
  T extends JourneyTypes,
  TStepKey extends T["stepId"],
  THandledCustomEventType extends JourneyBuilderCustomEventKey<T["events"]> = never
> = {
  readonly id: TStepKey;
  readonly _meta: T["meta"] | undefined;
  readonly _onEnter:
    | JourneyStepLifecycleCallback<T["context"], T["stepId"], T["events"], T["handlers"]>
    | undefined;
  readonly _onLeave:
    | JourneyStepLifecycleCallback<T["context"], T["stepId"], T["events"], T["handlers"]>
    | undefined;
  readonly _on:
    | Record<string, JourneyBuilderEventEntry<T, JourneyFullEventType<T["events"]>>>
    | undefined;
  readonly _effect?: JourneyStepEffect<T["context"], T["stepId"], T["handlers"]> | undefined;
  readonly _after?: Record<number, JourneyAfterTransition<T["context"], T["stepId"]>> | undefined;
  readonly _handledCustomEventType?: THandledCustomEventType;
};

type JourneyStepBuilderHandledCustomEventMap<
  T extends JourneyTypes,
  TSteps extends readonly {
    readonly id: T["stepId"];
    readonly _handledCustomEventType?: JourneyBuilderCustomEventKey<T["events"]>;
  }[]
> = {
  [TCurrentStepId in T["stepId"]]: Extract<
    Extract<TSteps[number], { readonly id: TCurrentStepId }> extends {
      readonly _handledCustomEventType?: infer THandledCustomEventType;
    }
      ? THandledCustomEventType
      : never,
    JourneyBuilderCustomEventKey<T["events"]>
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
  T extends JourneyTypes,
  TStepHandledCustomEventMap extends Record<
    T["stepId"],
    JourneyBuilderCustomEventKey<T["events"]>
  > = Record<T["stepId"], never>,
  TGlobalHandledCustomEventType extends JourneyBuilderCustomEventKey<T["events"]> = never
> = JourneyDefinition<T["context"], T["stepId"], T["events"], T["meta"], T["handlers"]> &
  JourneyBuilderDefinitionMetadata<
    T["stepId"],
    T["events"],
    TStepHandledCustomEventMap,
    TGlobalHandledCustomEventType
  >;

type JourneyBuilderGlobalConfig<T extends JourneyTypes> = Partial<{
  [TEventType in JourneyFullEventType<
    T["events"]
  >]: TEventType extends JourneyBuilderTerminalEventKey<T["events"]>
    ? JourneyBuilderTerminalEntry<T, TEventType>
    : readonly JourneyBuiltTransitionCandidate<T>[];
}>;

type JourneyBuilderBuildInput<
  T extends JourneyTypes,
  TSteps extends readonly JourneyStepBuilder<
    T,
    T["stepId"],
    JourneyBuilderCustomEventKey<T["events"]>
  >[],
  TGlobal extends JourneyBuilderGlobalConfig<T> | undefined =
    | JourneyBuilderGlobalConfig<T>
    | undefined
> = {
  initial: T["stepId"];
  context: T["context"];
  handlers?: T["handlers"];
  steps: TSteps;
  global?: TGlobal;
};

export type JourneyBuilder<T extends JourneyTypes> = {
  createStep: <
    TStepKey extends T["stepId"],
    TOn extends JourneyStepBuilderOnConfig<T> | undefined =
      | JourneyStepBuilderOnConfig<T>
      | undefined,
    TEffectOutput = unknown
  >(
    id: TStepKey,
    config?: JourneyStepBuilderConfig<T, TOn, TEffectOutput>
  ) => JourneyStepBuilder<T, TStepKey, JourneyStepBuilderHandledCustomEventKey<T["events"], TOn>>;
  to: (stepId: T["stepId"]) => JourneyToBuilder<T>;
  build: <
    TSteps extends readonly JourneyStepBuilder<
      T,
      T["stepId"],
      JourneyBuilderCustomEventKey<T["events"]>
    >[],
    TGlobal extends JourneyBuilderGlobalConfig<T> | undefined =
      | JourneyBuilderGlobalConfig<T>
      | undefined
  >(
    input: JourneyBuilderBuildInput<T, TSteps, TGlobal>
  ) => JourneyBuilderDefinition<
    T,
    JourneyStepBuilderHandledCustomEventMap<T, TSteps>,
    JourneyBuilderGlobalHandledCustomEventKey<T["events"], TGlobal>
  >;
};

export type {
  JourneyStepBuilderConfig as _JourneyStepBuilderConfig,
  JourneyBuilderBuildInput as _JourneyBuilderBuildInput,
  JourneyBuilderEventEntry as _JourneyBuilderEventEntry
};
