import type {
  GraphJourneyDefinition,
  GraphStepConfig,
  GraphTransitionCandidate
} from "./graph.types";
import type {
  HandlersOf,
  JourneyBuilder,
  JourneyStepBuilder,
  JourneyToBuilder,
  JourneyTypeBag,
  MetaOf,
  ToFactory
} from "./builder.types";

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
