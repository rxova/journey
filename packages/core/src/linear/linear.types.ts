import type {
  AnyJourneyPlugin,
  CompletePayloadOf,
  JourneyMachineBase,
  JourneyTerminationPayloads,
  LinearSnapshot,
  NavigationResult,
  OnEnterHook,
  OnLeaveHook,
  PluginApis,
  TerminatePayloadOf
} from "../core/types";

// Termination payload helpers moved to core/types: both tiers name them now.
export type {
  CompletePayloadOf,
  JourneyTerminationPayloads,
  TerminatePayloadOf
} from "../core/types";

/** Full linear step config; a bare string is shorthand for `{ id, metadata: {} }`. */
export type LinearStepConfig<
  TContext = unknown,
  TStepId extends string = string,
  TMeta = Record<string, unknown>,
  TCompletePayload = unknown,
  TTerminatePayload = unknown
> = {
  readonly id: TStepId;
  readonly metadata?: TMeta;
  readonly onEnter?: OnEnterHook<
    TContext,
    TStepId,
    never,
    LinearSnapshot<TContext, TStepId, TMeta, TCompletePayload, TTerminatePayload>
  >;
  readonly onLeave?: OnLeaveHook<
    TContext,
    TStepId,
    never,
    LinearSnapshot<TContext, TStepId, TMeta, TCompletePayload, TTerminatePayload>
  >;
};

export type LinearStepInput<
  TContext,
  TMeta,
  TStepId extends string = string,
  TCompletePayload = unknown,
  TTerminatePayload = unknown
> = TStepId | LinearStepConfig<TContext, TStepId, TMeta, TCompletePayload, TTerminatePayload>;

/**
 * Pure-data linear definition: testable, reusable, and the unit
 * `linearToGraphDefinition` operates on.
 */
export type LinearJourneyDefinition<
  TStepId extends string = string,
  TContext = unknown,
  TTerminationPayloads extends JourneyTerminationPayloads = JourneyTerminationPayloads,
  TMeta = Record<string, unknown>
> = {
  readonly steps: readonly LinearStepInput<
    TContext,
    TMeta,
    TStepId,
    CompletePayloadOf<TTerminationPayloads>,
    TerminatePayloadOf<TTerminationPayloads>
  >[];
  readonly context: TContext;
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
> = Omit<
  JourneyMachineBase<
    TContext,
    TStepId,
    LinearSnapshot<TContext, TStepId, TMeta, TCompletePayload, TTerminatePayload>,
    TCompletePayload,
    TTerminatePayload
  >,
  "navigate"
> & {
  readonly navigate: JourneyMachineBase<
    TContext,
    TStepId,
    LinearSnapshot<TContext, TStepId, TMeta, TCompletePayload, TTerminatePayload>,
    TCompletePayload,
    TTerminatePayload
  >["navigate"] & {
    /** Declared-order index navigation; out-of-range indexes reject with "invalid-target". */
    goToStepByIndex(index: number): Promise<NavigationResult<TStepId>>;
  };
  readonly plugins: PluginApis<TPlugins>;
};
