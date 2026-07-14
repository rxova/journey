import { buildMachineSurface } from "../core/machine";
import { JourneyRuntime } from "../core/runtime";
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
 * and cannot be async. Async validation belongs in `onLeave`.
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

type SendArgs<TEvents extends JourneyEventObject, TType extends TEvents["type"]> =
  JourneyEventPayload<TEvents, TType> extends undefined
    ? []
    : [payload: JourneyEventPayload<TEvents, TType>];

/**
 * Declared events (builder type bag / explicit generic) get exact payload
 * tuples; undeclared events fall back to `(type, payload?)`.
 */
type SendVerb<
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
type LooseGraphDefinition = {
  readonly steps: Readonly<Record<string, GraphStepConfig>>;
  readonly transitions: Readonly<
    Record<string, GraphTransitionCandidate | readonly GraphTransitionCandidate[] | undefined>
  >;
  readonly initial: string;
  readonly context: unknown;
  readonly handlers?: unknown;
};

type MutableRuntimeStep = {
  metadata: unknown;
  onEnter?: NonNullable<RuntimeStep["onEnter"]>;
  onLeave?: NonNullable<RuntimeStep["onLeave"]>;
};

type MutableRuntimeTransition = {
  event: string;
  from: string;
  to: string;
  when?: NonNullable<RuntimeTransition["when"]>;
  onTransition?: NonNullable<RuntimeTransition["onTransition"]>;
};

/** Flattens the transitions map in declaration order and validates step refs. */
export function normalizeGraphDefinition(definition: LooseGraphDefinition): {
  stepIds: string[];
  steps: Record<string, RuntimeStep>;
  transitions: RuntimeTransition[];
} {
  const stepIds = Object.keys(definition.steps);
  if (stepIds.length === 0) {
    throw new Error("journey: a graph journey needs at least one step");
  }
  if (!stepIds.includes(definition.initial)) {
    throw new Error(`journey: initial step "${definition.initial}" is not a declared step`);
  }

  const steps: Record<string, RuntimeStep> = {};
  for (const id of stepIds) {
    const config = definition.steps[id] as GraphStepConfig;
    const runtimeStep: MutableRuntimeStep = { metadata: config.metadata ?? {} };
    if (config.onEnter) {
      runtimeStep.onEnter = config.onEnter as unknown as NonNullable<RuntimeStep["onEnter"]>;
    }
    if (config.onLeave) {
      runtimeStep.onLeave = config.onLeave as unknown as NonNullable<RuntimeStep["onLeave"]>;
    }
    steps[id] = runtimeStep;
  }

  const transitions: RuntimeTransition[] = [];
  for (const [event, entry] of Object.entries(definition.transitions)) {
    if (entry === undefined) continue;
    const candidates = (Array.isArray(entry) ? entry : [entry]) as GraphTransitionCandidate[];
    for (const candidate of candidates) {
      for (const ref of [candidate.from, candidate.to]) {
        if (!stepIds.includes(ref)) {
          throw new Error(`journey: transition "${event}" references unknown step "${ref}"`);
        }
      }
      const runtimeTransition: MutableRuntimeTransition = {
        event,
        from: candidate.from,
        to: candidate.to
      };
      if (candidate.when) {
        runtimeTransition.when = candidate.when as NonNullable<RuntimeTransition["when"]>;
      }
      if (candidate.onTransition) {
        runtimeTransition.onTransition = candidate.onTransition as unknown as NonNullable<
          RuntimeTransition["onTransition"]
        >;
      }
      transitions.push(runtimeTransition);
    }
  }

  return { stepIds, steps, transitions };
}

/**
 * Creates a graph journey runtime from a pure-data definition.
 *
 * `send(event, payload?)` is the primary verb; `goToStepById` is
 * transition-gated sugar (fires only if an enabled transition targets that
 * id). Timeline moves bypass transition gating — retracing a walked path is
 * always legal — but step `onLeave` guards still run.
 */
export function createGraphJourney<
  TContext,
  TStepId extends string,
  TEvents extends JourneyEventObject = JourneyEventObject,
  THandlers = unknown,
  TMeta = Record<string, unknown>,
  const TPlugins extends readonly AnyJourneyPlugin[] = readonly []
>(
  // Inline shape (not GraphJourneyDefinition) so TStepId infers from the
  // steps-record keys alone: every other occurrence is NoInfer-wrapped,
  // otherwise `initial` would win inference and collapse the id union.
  definition: {
    readonly steps: Readonly<
      Record<TStepId, GraphStepConfig<NoInfer<TContext>, NoInfer<TStepId>, NoInfer<TEvents>, TMeta>>
    >;
    readonly transitions: GraphTransitionsMap<
      NoInfer<TContext>,
      NoInfer<TStepId>,
      NoInfer<TEvents>,
      NoInfer<THandlers>,
      NoInfer<TMeta>
    >;
    readonly initial: NoInfer<TStepId>;
    readonly context: TContext;
    readonly handlers?: THandlers;
    readonly $events?: TEvents;
  },
  options: GraphJourneyOptions<NoInfer<THandlers>, TPlugins> = {}
): GraphJourneyMachine<TContext, TStepId, TEvents, TMeta, TPlugins> {
  const { stepIds, steps, transitions } = normalizeGraphDefinition(
    definition as unknown as LooseGraphDefinition
  );

  const runtime = new JourneyRuntime({
    kind: "graph",
    stepIds,
    steps,
    initial: definition.initial,
    initialContext: definition.context,
    transitions,
    handlers: options.handlers ?? definition.handlers,
    autoStart: options.autoStart ?? false,
    defaultTimeoutMs: options.defaultTimeoutMs,
    plugins: options.plugins ?? []
  });

  const machine = {
    ...buildMachineSurface(runtime),
    send: (type: string, payload?: unknown) => runtime.send(type, payload)
  };
  return machine as unknown as GraphJourneyMachine<TContext, TStepId, TEvents, TMeta, TPlugins>;
}
