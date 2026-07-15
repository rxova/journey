import type {
  AnyJourneyPlugin,
  JourneyMachineBase,
  LinearSnapshot,
  OnEnterHook,
  OnLeaveHook,
  PluginApis
} from "../core/types";

/** Optional type-only declarations for terminal outcome payloads. */
export type JourneyOutcomeTypes = {
  readonly complete?: unknown;
  readonly terminate?: unknown;
};

export type CompletePayloadOf<TTypes extends JourneyOutcomeTypes> = TTypes extends {
  readonly complete: infer TPayload;
}
  ? TPayload
  : unknown;

export type TerminatePayloadOf<TTypes extends JourneyOutcomeTypes> = TTypes extends {
  readonly terminate: infer TPayload;
}
  ? TPayload
  : unknown;

/** Full linear step config; a bare string is shorthand for `{ id, metadata: {} }`. */
export type LinearStepConfig<
  TContext = unknown,
  TStepId extends string = string,
  TMeta = Record<string, unknown>
> = {
  readonly id: TStepId;
  readonly metadata?: TMeta;
  readonly onEnter?: OnEnterHook<
    TContext,
    TStepId,
    never,
    LinearSnapshot<TContext, TStepId, TMeta>
  >;
  readonly onLeave?: OnLeaveHook<
    TContext,
    TStepId,
    never,
    LinearSnapshot<TContext, TStepId, TMeta>
  >;
};

export type LinearStepInput<TContext, TMeta> = string | LinearStepConfig<TContext, string, TMeta>;

/**
 * Pure-data linear definition: testable, reusable, and the unit
 * `linearToGraphDefinition` operates on.
 */
export type LinearJourneyDefinition<
  TContext = unknown,
  TMeta = Record<string, unknown>,
  TOutcomeTypes extends JourneyOutcomeTypes = JourneyOutcomeTypes
> = {
  readonly steps: readonly LinearStepInput<TContext, TMeta>[];
  readonly context: TContext;
  /** Compile-time only; the factory does not read or retain this object. */
  readonly types?: TOutcomeTypes;
};

/** Step ids inferred as a literal union from the steps tuple. */
export type LinearStepIdOf<TSteps extends readonly (string | { readonly id: string })[]> =
  TSteps[number] extends infer TStep
    ? TStep extends string
      ? TStep
      : TStep extends { readonly id: infer TId extends string }
        ? TId
        : never
    : never;

export type LinearJourneyMachine<
  TContext,
  TStepId extends string,
  TMeta = Record<string, unknown>,
  TPlugins extends readonly AnyJourneyPlugin[] = readonly [],
  TCompletePayload = unknown,
  TTerminatePayload = unknown
> = JourneyMachineBase<
  TContext,
  TStepId,
  LinearSnapshot<TContext, TStepId, TMeta, TCompletePayload, TTerminatePayload>,
  TCompletePayload,
  TTerminatePayload
> & {
  readonly plugins: PluginApis<TPlugins>;
};
