import type {
  GraphHookArgs,
  GraphJourneyDefinition,
  GraphStepConfig,
  GraphTransitionCandidate,
  TransitionGuard
} from "./index";
import type { JourneyEventObject, OnEnterHook, OnLeaveHook } from "../core/types";
import type { GraphSnapshot } from "../core/types";

/**
 * One declaration point for a journey's types — steps can then be authored in
 * separate files without threading generics through each one.
 */
export type JourneyTypeBag = {
  context: unknown;
  stepId: string;
  events: JourneyEventObject;
  meta?: unknown;
  handlers?: unknown;
};

type MetaOf<TBag extends JourneyTypeBag> = TBag extends { meta: infer TMeta }
  ? TMeta
  : Record<string, unknown>;
type HandlersOf<TBag extends JourneyTypeBag> = TBag extends { handlers: infer THandlers }
  ? THandlers
  : Record<string, never>;

type BagSnapshot<TBag extends JourneyTypeBag> = GraphSnapshot<
  TBag["context"],
  TBag["stepId"],
  MetaOf<TBag>,
  TBag["events"]
>;

/** Chainable transition candidate under construction (no `from` yet). */
export type JourneyToBuilder<TBag extends JourneyTypeBag, TType extends TBag["events"]["type"]> = {
  readonly _candidate: {
    readonly to: TBag["stepId"];
    readonly when?: TransitionGuard<TBag["context"], HandlersOf<TBag>>;
    readonly onTransition?: (
      args: GraphHookArgs<TBag["context"], TBag["stepId"], TBag["events"], MetaOf<TBag>>
    ) => void | Promise<void>;
  };
  when(guard: TransitionGuard<TBag["context"], HandlersOf<TBag>>): JourneyToBuilder<TBag, TType>;
  onTransition(
    effect: (
      args: GraphHookArgs<
        TBag["context"],
        TBag["stepId"],
        Extract<TBag["events"], { type: TType }>,
        MetaOf<TBag>
      >
    ) => void | Promise<void>
  ): JourneyToBuilder<TBag, TType>;
};

type ToFactory<TBag extends JourneyTypeBag, TType extends TBag["events"]["type"]> = (
  target: TBag["stepId"]
) => JourneyToBuilder<TBag, TType>;

/**
 * Per-event candidates: an array, or a callback receiving an event-scoped `to`
 * so `onTransition` sees the narrowed event payload.
 */
export type JourneyStepTransitions<TBag extends JourneyTypeBag> = {
  readonly [TType in TBag["events"]["type"]]?:  // array form: wide event type; the callback form's scoped `to` narrows it
    | readonly JourneyToBuilder<TBag, TBag["events"]["type"]>[]
    | ((helpers: { to: ToFactory<TBag, TType> }) => readonly JourneyToBuilder<TBag, TType>[]);
};

export type JourneyStepBuilder<
  TBag extends JourneyTypeBag,
  TStepId extends TBag["stepId"] = TBag["stepId"]
> = {
  readonly id: TStepId;
  readonly _config: {
    readonly metadata?: MetaOf<TBag>;
    readonly onEnter?: OnEnterHook<
      TBag["context"],
      TBag["stepId"],
      TBag["events"],
      BagSnapshot<TBag>
    >;
    readonly onLeave?: OnLeaveHook<
      TBag["context"],
      TBag["stepId"],
      TBag["events"],
      BagSnapshot<TBag>
    >;
    readonly on?: JourneyStepTransitions<TBag>;
  };
};

export type JourneyBuilder<TBag extends JourneyTypeBag> = {
  createStep<TStepId extends TBag["stepId"]>(
    id: TStepId,
    config?: JourneyStepBuilder<TBag, TStepId>["_config"]
  ): JourneyStepBuilder<TBag, TStepId>;
  to: ToFactory<TBag, TBag["events"]["type"]>;
  build(input: {
    initial: TBag["stepId"];
    context: TBag["context"];
    handlers?: HandlersOf<TBag>;
    steps: readonly JourneyStepBuilder<TBag>[];
  }): GraphJourneyDefinition<
    TBag["context"],
    TBag["stepId"],
    TBag["events"],
    HandlersOf<TBag>,
    MetaOf<TBag>
  >;
};

/**
 * Returns typed `{ createStep, to, build }` for the given type bag. Steps are
 * authored colocated (each step declares its own outgoing transitions under
 * `on`); `build()` normalizes everything into the canonical definition shape —
 * a steps record plus the central transitions map keyed by event.
 */
export function createGraphJourneyBuilder<TBag extends JourneyTypeBag>(): JourneyBuilder<TBag> {
  type Candidate = JourneyToBuilder<TBag, TBag["events"]["type"]>["_candidate"];

  function makeToBuilder(candidate: Candidate): JourneyToBuilder<TBag, TBag["events"]["type"]> {
    return {
      _candidate: candidate,
      when(guard) {
        return makeToBuilder({ ...candidate, when: guard });
      },
      onTransition(effect) {
        return makeToBuilder({
          ...candidate,
          onTransition: effect as unknown as NonNullable<Candidate["onTransition"]>
        });
      }
    };
  }

  const to: ToFactory<TBag, TBag["events"]["type"]> = (target) => makeToBuilder({ to: target });

  function createStep<TStepId extends TBag["stepId"]>(
    id: TStepId,
    config: JourneyStepBuilder<TBag, TStepId>["_config"] = {}
  ): JourneyStepBuilder<TBag, TStepId> {
    return { id, _config: config };
  }

  function build(input: {
    initial: TBag["stepId"];
    context: TBag["context"];
    handlers?: HandlersOf<TBag>;
    steps: readonly JourneyStepBuilder<TBag>[];
  }): GraphJourneyDefinition<
    TBag["context"],
    TBag["stepId"],
    TBag["events"],
    HandlersOf<TBag>,
    MetaOf<TBag>
  > {
    const steps: Record<string, GraphStepConfig> = {};
    const transitions: Record<string, GraphTransitionCandidate[]> = {};

    for (const step of input.steps) {
      if (step.id in steps) {
        throw new Error(`journey: duplicate step id "${step.id}"`);
      }
      const config = step._config;
      const stepConfig: {
        metadata: Record<string, unknown>;
        onEnter?: NonNullable<GraphStepConfig["onEnter"]>;
        onLeave?: NonNullable<GraphStepConfig["onLeave"]>;
      } = { metadata: (config.metadata ?? {}) as Record<string, unknown> };
      if (config.onEnter) {
        stepConfig.onEnter = config.onEnter as unknown as NonNullable<GraphStepConfig["onEnter"]>;
      }
      if (config.onLeave) {
        stepConfig.onLeave = config.onLeave as unknown as NonNullable<GraphStepConfig["onLeave"]>;
      }
      steps[step.id] = stepConfig;

      if (!config.on) continue;
      for (const [event, entry] of Object.entries(config.on)) {
        if (entry === undefined) continue;
        const builders =
          typeof entry === "function"
            ? entry({ to: to as unknown as ToFactory<TBag, never> })
            : (entry as readonly JourneyToBuilder<TBag, TBag["events"]["type"]>[]);
        const bucket = (transitions[event] ??= []);
        for (const builder of builders) {
          bucket.push({
            from: step.id,
            ...builder._candidate
          } as GraphTransitionCandidate);
        }
      }
    }

    return {
      initial: input.initial,
      context: input.context,
      ...(input.handlers !== undefined ? { handlers: input.handlers } : {}),
      steps,
      transitions
    } as unknown as GraphJourneyDefinition<
      TBag["context"],
      TBag["stepId"],
      TBag["events"],
      HandlersOf<TBag>,
      MetaOf<TBag>
    >;
  }

  return { createStep, to, build };
}
