import type { AnySendWork, RuntimeStep, RuntimeTransition } from "../core/runtime.types.js";
import type {
  AnyJourneyPlugin,
  ContextUpdater,
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
} from "../core/types.js";

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
  /** Work declared on an event, keyed by origin step and event (builder-produced). */
  readonly eventWork?: Readonly<Record<string, AnySendWork>>;
  readonly $events?: TEvents;
};

export type GraphJourneyOptions<
  THandlers = unknown,
  TPlugins extends readonly AnyJourneyPlugin[] = readonly [],
  TStepId extends string = string
> = JourneyRuntimeOptions<TPlugins, TStepId> & {
  /** Overrides the definition's handlers — one definition serves app and tests. */
  handlers?: THandlers;
};

export type SendArgs<TEvents extends JourneyEventObject, TType extends TEvents["type"]> =
  JourneyEventPayload<TEvents, TType> extends undefined
    ? []
    : [payload: JourneyEventPayload<TEvents, TType>];

/**
 * Arguments for work attached to a `send`.
 *
 * There is no `to`: the work runs *before* routing, so no target has been
 * chosen yet. `handlers` is threaded through because this is the async that a
 * definition owns, and injected clients reach it no other way — step hooks
 * deliberately do not receive handlers.
 */
export type SendWorkArgs<
  TStepId extends string,
  TEvents extends JourneyEventObject,
  TSnap,
  THandlers
> = {
  readonly snapshot: TSnap;
  readonly from: TStepId;
  readonly event: TEvents;
  readonly handlers: THandlers;
};

/**
 * Async attached to an event, run before the guards choose an edge.
 *
 * `run` is awaited while the machine holds its position. `commit` then stages
 * context synchronously, and the guards are evaluated against that staged
 * context — so the work supplies the facts routing is decided from without
 * guards ever becoming async. If `run` throws, or no candidate is enabled once
 * the context is staged, nothing commits and the machine stays put.
 */
export type SendWork<
  TContext,
  TStepId extends string,
  TEvents extends JourneyEventObject,
  TSnap,
  THandlers = unknown,
  TResult = void
> = {
  readonly run: (
    args: SendWorkArgs<TStepId, TEvents, TSnap, THandlers>
  ) => TResult | Promise<TResult>;
  readonly commit?: (
    args: SendWorkArgs<TStepId, TEvents, TSnap, THandlers> & {
      readonly result: TResult;
      readonly updateContext: (updater: ContextUpdater<TContext>) => void;
    }
  ) => void;
};

/**
 * Declared events (builder type bag / explicit generic) get exact payload
 * tuples; undeclared events fall back to `(type, payload?)`.
 */
export type SendVerb<
  TStepId extends string,
  TEvents extends JourneyEventObject,
  TContext = unknown,
  TSnap = unknown,
  THandlers = unknown
> = JourneyEventObject extends TEvents
  ? {
      // Work overloads come first: `payload?: unknown` would otherwise match a
      // work object and swallow it as a payload, losing all inference.
      <TResult = void>(
        type: string,
        work: SendWork<TContext, TStepId, TEvents, TSnap, THandlers, TResult>
      ): Promise<NavigationResult<TStepId>>;
      <TResult = void>(
        type: string,
        payload: unknown,
        work: SendWork<TContext, TStepId, TEvents, TSnap, THandlers, TResult>
      ): Promise<NavigationResult<TStepId>>;
      (type: string, payload?: unknown): Promise<NavigationResult<TStepId>>;
    }
  : {
      <TType extends TEvents["type"]>(
        type: TType,
        ...payload: SendArgs<TEvents, TType>
      ): Promise<NavigationResult<TStepId>>;
      /** Call-site work — the escape hatch when the async does not belong to the definition. */
      <TType extends TEvents["type"], TResult = void>(
        type: TType,
        payload: JourneyEventPayload<TEvents, TType>,
        work: SendWork<
          TContext,
          TStepId,
          Extract<TEvents, { type: TType }>,
          TSnap,
          THandlers,
          TResult
        >
      ): Promise<NavigationResult<TStepId>>;
      /** Payload-free events take work as the second argument. */
      <TType extends TEvents["type"], TResult = void>(
        type: JourneyEventPayload<TEvents, TType> extends undefined ? TType : never,
        work: SendWork<
          TContext,
          TStepId,
          Extract<TEvents, { type: TType }>,
          TSnap,
          THandlers,
          TResult
        >
      ): Promise<NavigationResult<TStepId>>;
    };

export type GraphJourneyMachine<
  TContext,
  TStepId extends string,
  TEvents extends JourneyEventObject = JourneyEventObject,
  TMeta = Record<string, unknown>,
  TPlugins extends readonly AnyJourneyPlugin[] = readonly [],
  THandlers = unknown
> = JourneyMachineBase<TContext, TStepId, GraphSnapshot<TContext, TStepId, TMeta, TEvents>> & {
  /**
   * The graph's primary verb — its presence is itself the machine-type
   * discriminant (linear has no events).
   */
  send: SendVerb<
    TStepId,
    TEvents,
    TContext,
    GraphSnapshot<TContext, TStepId, TMeta, TEvents>,
    THandlers
  >;
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
