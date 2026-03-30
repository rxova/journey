import type { JourneyDefinition, JourneyFullEventType, JourneyJsonObject } from "../types";
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

export type JourneyToBuilder<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>,
  TEventType extends JourneyFullEventType<TEventMap> = JourneyFullEventType<TEventMap>
> = {
  readonly _candidate: JourneyBuilderCandidate<TContext, TStepId, TEventMap, THandlers, TEventType>;
  when(
    guard: JourneyBuilderGuard<TContext, TStepId, TEventMap, THandlers, TEventType>
  ): JourneyToBuilder<TContext, TStepId, TEventMap, THandlers, TEventType>;
  updateContext(
    fn: JourneyBuilderUpdateContext<TContext, TStepId, TEventMap, TEventType>
  ): JourneyToBuilder<TContext, TStepId, TEventMap, THandlers, TEventType>;
  onEnter(
    fn: JourneyBuilderLifecycle<TContext, TStepId, TEventMap, THandlers>
  ): JourneyToBuilder<TContext, TStepId, TEventMap, THandlers, TEventType>;
  onLeave(
    fn: JourneyBuilderLifecycle<TContext, TStepId, TEventMap, THandlers>
  ): JourneyToBuilder<TContext, TStepId, TEventMap, THandlers, TEventType>;
  id(id: string): JourneyToBuilder<TContext, TStepId, TEventMap, THandlers, TEventType>;
  timeoutMs(ms: number): JourneyToBuilder<TContext, TStepId, TEventMap, THandlers, TEventType>;
};

export type JourneyBuilderOnEntry<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>,
  TEventType extends JourneyBuilderStepEventKey<TEventMap>
> =
  | readonly JourneyToBuilder<TContext, TStepId, TEventMap, THandlers>[]
  | ((helpers: {
      to: (
        stepId: TStepId
      ) => JourneyToBuilder<TContext, TStepId, TEventMap, THandlers, TEventType>;
    }) => readonly JourneyToBuilder<TContext, TStepId, TEventMap, THandlers, TEventType>[]);

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

type JourneyStepBuilderConfig<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta,
  THandlers extends Record<string, unknown>
> = {
  meta?: TStepMeta;
  onEnter?: JourneyStepLifecycleCallback<TContext, TStepId, TEventMap, THandlers>;
  onLeave?: JourneyStepLifecycleCallback<TContext, TStepId, TEventMap, THandlers>;
  on?: Partial<{
    [TEventType in JourneyFullEventType<TEventMap>]: JourneyBuilderEventEntry<
      TContext,
      TStepId,
      TEventMap,
      THandlers,
      TEventType
    >;
  }>;
};

export type JourneyStepBuilder<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TStepKey extends TStepId,
  TEventMap extends Record<string, unknown>,
  TStepMeta,
  THandlers extends Record<string, unknown>
> = {
  readonly _id: TStepKey;
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
};

type JourneyBuilderGlobalConfig<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>
> = Partial<{
  [TEventType in JourneyFullEventType<TEventMap>]: TEventType extends JourneyBuilderTerminalEventKey<TEventMap>
    ? JourneyBuilderTerminalEntry<TContext, TStepId, TEventMap, THandlers, TEventType>
    : readonly JourneyToBuilder<TContext, TStepId, TEventMap, THandlers>[];
}>;

type JourneyBuilderBuildInput<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta,
  THandlers extends Record<string, unknown>
> = {
  initial: TStepId;
  context: TContext;
  handlers?: THandlers;
  steps: readonly JourneyStepBuilder<TContext, TStepId, TStepId, TEventMap, TStepMeta, THandlers>[];
  global?: JourneyBuilderGlobalConfig<TContext, TStepId, TEventMap, THandlers>;
};

export type JourneyBuilder<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>
> = {
  createStep: <TStepKey extends TStepId>(
    id: TStepKey,
    config?: JourneyStepBuilderConfig<TContext, TStepId, TEventMap, TStepMeta, THandlers>
  ) => JourneyStepBuilder<TContext, TStepId, TStepKey, TEventMap, TStepMeta, THandlers>;
  to: (stepId: TStepId) => JourneyToBuilder<TContext, TStepId, TEventMap, THandlers>;
  build: (
    input: JourneyBuilderBuildInput<TContext, TStepId, TEventMap, TStepMeta, THandlers>
  ) => JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>;
};

export type {
  JourneyStepBuilderConfig as _JourneyStepBuilderConfig,
  JourneyBuilderBuildInput as _JourneyBuilderBuildInput,
  JourneyBuilderEventEntry as _JourneyBuilderEventEntry
};
