import type { RuntimeStep, RuntimeTransition } from "../core/runtime.types";
import type {
  AnyJourneyPlugin,
  GraphSnapshot,
  JourneyEventObject,
  JourneyEventPayload,
  JourneyMachineBase,
  JourneyRuntimeOptions,
  NavigationResult,
  OnEnterHook,
  OnLeaveHook,
  PluginApis,
  StepHookArgs
} from "../core/types";

/**
 * Guards are sync and pure: they are evaluated during snapshot derivation to
 * compute `availableEvents`/`availableSteps`, so they receive no event payload
 * and cannot be async. Caller-driven async validation belongs in navigation work.
 */
export type TransitionGuard<TContext, THandlers> = (args: {
  readonly context: TContext;
  readonly handlers: THandlers;
}) => boolean;

export type GraphHookArgs<
  TContext,
  TStepId extends string,
  TEvents extends JourneyEventObject,
  TMeta = Record<string, unknown>
> = StepHookArgs<TContext, TStepId, TEvents, GraphSnapshot<TContext, TStepId, TMeta, TEvents>>;

export type GraphStepConfig<
  TContext = unknown,
  TStepId extends string = string,
  TEvents extends JourneyEventObject = JourneyEventObject,
  TMeta = Record<string, unknown>
> = {
  readonly metadata?: TMeta;
  readonly onEnter?: OnEnterHook<
    TContext,
    TStepId,
    TEvents,
    GraphSnapshot<TContext, TStepId, TMeta, TEvents>
  >;
  readonly onLeave?: OnLeaveHook<
    TContext,
    TStepId,
    TEvents,
    GraphSnapshot<TContext, TStepId, TMeta, TEvents>
  >;
};

/** One transition candidate; for an event array, first enabled in order wins. */
export type GraphTransitionCandidate<
  TContext = unknown,
  TStepId extends string = string,
  TEvents extends JourneyEventObject = JourneyEventObject,
  THandlers = unknown,
  TMeta = Record<string, unknown>
> = {
  readonly from: TStepId;
  readonly to: TStepId;
  readonly when?: TransitionGuard<TContext, THandlers>;
  /** Async effect, post-commit, cannot cancel; a throw is handled like an `onEnter` throw. */
  readonly onTransition?: (
    args: GraphHookArgs<TContext, TStepId, TEvents, TMeta>
  ) => void | Promise<void>;
};

/** Transitions declared as a map keyed by event name. */
export type GraphTransitionsMap<
  TContext = unknown,
  TStepId extends string = string,
  TEvents extends JourneyEventObject = JourneyEventObject,
  THandlers = unknown,
  TMeta = Record<string, unknown>
> = {
  readonly [TType in TEvents["type"]]?:
    | GraphTransitionCandidate<TContext, TStepId, TEvents, THandlers, TMeta>
    | readonly GraphTransitionCandidate<TContext, TStepId, TEvents, THandlers, TMeta>[];
};

/**
 * Pure-data graph definition (also what the builder's `build()` produces).
 * `$events` is a phantom carrier for the declared event union — never set at
 * runtime.
 */
export type GraphJourneyDefinition<
  TContext = unknown,
  TStepId extends string = string,
  TEvents extends JourneyEventObject = JourneyEventObject,
  THandlers = unknown,
  TMeta = Record<string, unknown>
> = {
  readonly steps: Readonly<Record<TStepId, GraphStepConfig<TContext, TStepId, TEvents, TMeta>>>;
  readonly transitions: GraphTransitionsMap<TContext, TStepId, TEvents, THandlers, TMeta>;
  readonly initial: TStepId;
  readonly context: TContext;
  readonly handlers?: THandlers;
  readonly $events?: TEvents;
};

export type GraphJourneyOptions<
  THandlers = unknown,
  TPlugins extends readonly AnyJourneyPlugin[] = readonly []
> = JourneyRuntimeOptions<TPlugins> & {
  /** Overrides the definition's handlers — one definition serves app and tests. */
  handlers?: THandlers;
};

export type SendArgs<TEvents extends JourneyEventObject, TType extends TEvents["type"]> =
  JourneyEventPayload<TEvents, TType> extends undefined
    ? []
    : [payload: JourneyEventPayload<TEvents, TType>];

/**
 * Declared events (builder type bag / explicit generic) get exact payload
 * tuples; undeclared events fall back to `(type, payload?)`.
 */
export type SendVerb<
  TStepId extends string,
  TEvents extends JourneyEventObject
> = JourneyEventObject extends TEvents
  ? (type: string, payload?: unknown) => Promise<NavigationResult<TStepId>>
  : <TType extends TEvents["type"]>(
      type: TType,
      ...payload: SendArgs<TEvents, TType>
    ) => Promise<NavigationResult<TStepId>>;

export type GraphJourneyMachine<
  TContext,
  TStepId extends string,
  TEvents extends JourneyEventObject = JourneyEventObject,
  TMeta = Record<string, unknown>,
  TPlugins extends readonly AnyJourneyPlugin[] = readonly []
> = JourneyMachineBase<TContext, TStepId, GraphSnapshot<TContext, TStepId, TMeta, TEvents>> & {
  /**
   * The graph's primary verb — its presence is itself the machine-type
   * discriminant (linear has no events).
   */
  send: SendVerb<TStepId, TEvents>;
  readonly plugins: PluginApis<TPlugins>;
};

/** Internal, generics-erased view of a definition used by normalization. */
export type LooseGraphDefinition = {
  readonly steps: Readonly<Record<string, GraphStepConfig>>;
  readonly transitions: Readonly<
    Record<string, GraphTransitionCandidate | readonly GraphTransitionCandidate[] | undefined>
  >;
  readonly initial: string;
  readonly context: unknown;
  readonly handlers?: unknown;
};

export type MutableRuntimeStep = {
  metadata: unknown;
  onEnter?: NonNullable<RuntimeStep["onEnter"]>;
  onLeave?: NonNullable<RuntimeStep["onLeave"]>;
};

export type MutableRuntimeTransition = {
  event: string;
  from: string;
  to: string;
  when?: NonNullable<RuntimeTransition["when"]>;
  onTransition?: NonNullable<RuntimeTransition["onTransition"]>;
};
