import type {
  GraphJourneyDefinition,
  GraphStepConfig,
  GraphTransitionCandidate
} from "./graph.types";
import { eventWorkKey } from "../core/helpers";
import type { AnySendWork } from "../core/runtime.types";
import type {
  HandlersOf,
  JourneyBuilder,
  JourneyEventWork,
  JourneyStepBuilder,
  JourneyToBuilder,
  JourneyTypeBag,
  MetaOf,
  StayFactory,
  ToFactory,
  WorkFactory
} from "./builder.types";

/**
 * The totality warning is authoring feedback, not runtime behavior, so it is
 * silenced in production bundles. Read through globalThis: the core carries no
 * Node types and must not assume a bundler defines `process`.
 */
const isDevBuild = (): boolean => {
  const env = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV;
  return env !== "production";
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

  // Carries `run`/`commit` through as an opaque bundle: `build` only needs to
  // separate them from the candidates, never to call them. The config doubles
  // as `_work` — the runtime reads only `run`/`commit` and ignores the rest
  // (`allowRollback` is consumed by `build`'s totality check).
  const makeWork = (config: {
    run: unknown;
    commit?: unknown;
    allowRollback?: boolean;
    candidates: unknown;
  }) => ({ _work: config, candidates: config.candidates });

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
    const eventWork: Record<string, AnySendWork> = {};

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
      // `stay()` is sugar for an unguarded candidate back at this step — the
      // named form of the totality fallback.
      const stay = () => makeToBuilder({ to: step.id });
      for (const [event, entry] of Object.entries(config.on)) {
        if (entry === undefined) continue;
        const produced =
          typeof entry === "function"
            ? entry({
                to: to as unknown as ToFactory<TBag, never>,
                work: makeWork as unknown as WorkFactory<TBag, never>,
                stay: stay as unknown as StayFactory<TBag, never>
              })
            : (entry as readonly JourneyToBuilder<TBag, TBag["events"]["type"]>[]);

        // The callback form may return declared work instead of a bare list;
        // its candidates still land in the shared transitions map, and the work
        // is keyed by (origin step, event) for the runtime to pick up on send.
        const isWork = !Array.isArray(produced);
        let builders: readonly JourneyToBuilder<TBag, TBag["events"]["type"]>[];
        if (isWork) {
          const bundle = produced as JourneyEventWork<TBag, never>;
          // Work candidates may be a factory taking the work-scoped `to`/`stay`
          // (whose guards see the typed run result) instead of a plain array.
          const source = bundle.candidates as unknown;
          builders = (
            typeof source === "function" ? source({ to, stay }) : source
          ) as readonly JourneyToBuilder<TBag, TBag["events"]["type"]>[];
          eventWork[eventWorkKey(step.id, event)] = bundle._work as unknown as AnySendWork;

          if (
            isDevBuild() &&
            !(bundle._work as { allowRollback?: boolean }).allowRollback &&
            !builders.some((builder) => !builder._candidate.when)
          ) {
            console.warn(
              `journey: "${event}" work on "${step.id}" has only guarded candidates — a no-match send rolls back its staged context. Add stay() or allowRollback: true.`
            );
          }
        } else {
          builders = produced as readonly JourneyToBuilder<TBag, TBag["events"]["type"]>[];
        }

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
      ...(Object.keys(eventWork).length > 0 ? { eventWork } : {}),
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
