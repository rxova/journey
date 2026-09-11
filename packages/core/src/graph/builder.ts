import type { GraphJourneyDefinition, GraphStepConfig } from "./graph.types";
import { JourneyError } from "../core/errors";
import { hasOwn } from "../core/helpers";
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
 * Returns typed `{ createStep, to, build }` for the given type bag. Steps are
 * authored colocated — each declares its own outgoing transitions under `on` —
 * and `build()` normalizes them into the canonical definition shape: a steps
 * record whose entries carry their own `on`.
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

    for (const step of input.steps) {
      if (hasOwn(steps, step.id)) {
        throw new JourneyError("duplicate-step-id", `duplicate step id "${step.id}"`, {
          stepId: step.id
        });
      }
      const config = step._config;
      const stepConfig: {
        metadata: Record<string, unknown>;
        onEnter?: NonNullable<GraphStepConfig["onEnter"]>;
        onLeave?: NonNullable<GraphStepConfig["onLeave"]>;
        on?: Record<string, unknown>;
      } = { metadata: (config.metadata ?? {}) as Record<string, unknown> };
      if (config.onEnter) {
        stepConfig.onEnter = config.onEnter as unknown as NonNullable<GraphStepConfig["onEnter"]>;
      }
      if (config.onLeave) {
        stepConfig.onLeave = config.onLeave as unknown as NonNullable<GraphStepConfig["onLeave"]>;
      }
      steps[step.id] = stepConfig as unknown as GraphStepConfig;

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
        } else {
          builders = produced as readonly JourneyToBuilder<TBag, TBag["events"]["type"]>[];
        }

        const candidates = builders.map((builder) => builder._candidate);
        const on = (stepConfig.on ??= {});
        // Declared work keeps its candidates alongside it; a bare list is
        // emitted as the array form. `from` is implicit — it is this step.
        on[event] = isWork
          ? { ...((produced as JourneyEventWork<TBag, never>)._work as object), candidates }
          : candidates;
      }
    }

    return {
      initial: input.initial,
      context: input.context,
      ...(input.handlers !== undefined ? { handlers: input.handlers } : {}),
      steps
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
