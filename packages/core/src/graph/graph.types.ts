import type { AnySendWork, RuntimeStep, RuntimeTransition } from "../core/runtime.types";
import type {
  AnyJourneyPlugin,
  ContextUpdater,
  GraphSnapshot,
  JourneyEventObject,
  JourneyEventPayload,
  JourneyMachineBase,
  JourneyRuntimeOptions,
  JourneyTerminationPayloads,
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

/** One colocated candidate; `from` is the step that declares it. */
export type GraphTransition<
  TContext = unknown,
  TStepId extends string = string,
  TEvents extends JourneyEventObject = JourneyEventObject,
  THandlers = unknown,
  TMeta = Record<string, unknown>,
  // The event that triggered this edge, narrowed to the key the entry is
  // declared under. `raise` keeps the full union — you may raise any declared
  // event — so only `event` is overridden.
  TTrigger extends JourneyEventObject = TEvents
> = {
  readonly to: TStepId;
  readonly when?: TransitionGuard<TContext, THandlers>;
  /** Async effect, post-commit, cannot cancel; a throw is handled like an `onEnter` throw. */
  readonly onTransition?: (
    args: Omit<GraphHookArgs<TContext, TStepId, TEvents, TMeta>, "event"> & {
      readonly event: TTrigger | null;
    }
  ) => void | Promise<void>;
};

/**
 * What one event maps to on a step. Three forms, discriminated at the top
 * level so nothing has to sniff inside a candidate:
 *
 * - a step id — one unguarded candidate;
 * - an array — ordered candidates, first enabled wins;
 * - an object — async the machine owns, whose staged context the candidates
 *   are then evaluated against.
 *
 * A guarded lone candidate is `[{ to, when }]`: the extra brackets read
 * honestly, since a guarded lone candidate means the event can fail.
 */
export type GraphOnEntry<
  TContext = unknown,
  TStepId extends string = string,
  TEvents extends JourneyEventObject = JourneyEventObject,
  THandlers = unknown,
  TMeta = Record<string, unknown>,
  TResult = unknown,
  TTrigger extends JourneyEventObject = TEvents
> =
  | TStepId
  | readonly GraphTransition<TContext, TStepId, TEvents, THandlers, TMeta, TTrigger>[]
  | {
      readonly run: (
        args: SendWorkArgs<
          TStepId,
          TEvents,
          GraphSnapshot<TContext, TStepId, TMeta, TEvents>,
          THandlers
        >
      ) => TResult | Promise<TResult>;
      readonly commit?: (
        args: SendWorkArgs<
          TStepId,
          TEvents,
          GraphSnapshot<TContext, TStepId, TMeta, TEvents>,
          THandlers
        > & {
          readonly result: TResult;
          readonly updateContext: (updater: ContextUpdater<TContext>) => void;
        }
      ) => void;
      readonly candidates: readonly GraphTransition<TContext, TStepId, TEvents, THandlers, TMeta>[];
    };

export type GraphStepConfig<
  TContext = unknown,
  TStepId extends string = string,
  TEvents extends JourneyEventObject = JourneyEventObject,
  TMeta = Record<string, unknown>,
  THandlers = unknown
> = {
  readonly metadata?: TMeta;
  /** Outgoing transitions, keyed by event. */
  readonly on?: {
    readonly [TType in TEvents["type"]]?: GraphOnEntry<
      TContext,
      TStepId,
      TEvents,
      THandlers,
      TMeta,
      unknown,
      Extract<TEvents, { type: TType }>
    >;
  };
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
  TMeta = Record<string, unknown>,
  TTerminationPayloads extends JourneyTerminationPayloads = JourneyTerminationPayloads
> = {
  readonly steps: Readonly<
    Record<TStepId, GraphStepConfig<TContext, TStepId, TEvents, TMeta, THandlers>>
  >;
  readonly initial: TStepId;
  readonly context: TContext;
  readonly handlers?: THandlers;
  /**
   * Work declared on an event, collected by `normalizeGraphDefinition`.
   *
   * @internal Its keys are a private encoding of the (origin step, event) pair
   * and its values are internal work shapes. Typed as `unknown` on purpose so
   * neither is nameable from the public surface: hand this field straight back
   * to a factory, never construct or read it.
   */
  readonly eventWork?: Readonly<Record<string, unknown>>;
  /**
   * Phantom type carrier — never read at runtime. Names the event union, which
   * the definition's other fields cannot infer on their own.
   */
  readonly $events?: TEvents;
  /**
   * Phantom type carrier — never read at runtime. Names the completion and
   * termination payload types, so `controls.complete`/`terminate` and
   * `snapshot.machine.outcome` are typed instead of `unknown`.
   */
  readonly $payloads?: TTerminationPayloads;
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
 * Declared events get exact payload tuples; undeclared events fall back to
 * `(type, payload?)`.
 *
 * `send` takes no work: async that decides an event's outcome is declared on
 * the step, which is the graph's one channel for it.
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
  TPlugins extends readonly AnyJourneyPlugin[] = readonly [],
  TCompletePayload = unknown,
  TTerminatePayload = unknown
> = JourneyMachineBase<
  TContext,
  TStepId,
  GraphSnapshot<TContext, TStepId, TMeta, TEvents, TCompletePayload, TTerminatePayload>,
  TCompletePayload,
  TTerminatePayload
> & {
  /**
   * The graph's primary verb — its presence is itself the machine-type
   * discriminant (linear has no events).
   */
  send: SendVerb<TStepId, TEvents>;
  readonly plugins: PluginApis<TPlugins>;
};

/**
 * Internal, generics-erased view of one colocated `on` entry. The three forms
 * are discriminated structurally at the top level — string, array, object —
 * so normalization never has to sniff inside a candidate.
 */
export type LooseOnEntry =
  | string
  | readonly LooseTransition[]
  | {
      readonly run: AnySendWork["run"];
      readonly commit?: AnySendWork["commit"];
      readonly candidates: readonly LooseTransition[];
    };

/** A colocated candidate: `from` is the step that declares it. */
export type LooseTransition = {
  readonly to: string;
  readonly when?: NonNullable<RuntimeTransition["when"]>;
  readonly onTransition?: NonNullable<RuntimeTransition["onTransition"]>;
};

/** Internal, generics-erased view of a definition used by normalization. */
export type LooseGraphDefinition = {
  readonly steps: Readonly<
    Record<string, GraphStepConfig & { readonly on?: Readonly<Record<string, LooseOnEntry>> }>
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

export type MutableSendWork = {
  run: AnySendWork["run"];
  commit?: AnySendWork["commit"];
};

export type MutableRuntimeTransition = {
  event: string;
  from: string;
  to: string;
  when?: NonNullable<RuntimeTransition["when"]>;
  onTransition?: NonNullable<RuntimeTransition["onTransition"]>;
};
