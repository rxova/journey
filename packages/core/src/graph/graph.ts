import { buildMachineSurface } from "../core/machine";
import { JourneyRuntime } from "../core/runtime";
import { persistOptionToPlugin } from "../plugins/persistence/persistence";
import { readRestorableState } from "../plugins/persistence/persistence.helpers";
import type { RuntimeStep, RuntimeTransition } from "../core/runtime.types";
import type {
  GraphJourneyMachine,
  GraphJourneyOptions,
  GraphStepConfig,
  GraphTransitionCandidate,
  GraphTransitionsMap,
  LooseGraphDefinition,
  MutableRuntimeStep,
  MutableRuntimeTransition
} from "./graph.types";
import type { AnySendWork } from "../core/runtime.types";
import type { AnyJourneyPlugin, JourneyEventObject } from "../core/types";

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
 * always legal. Step `onLeave` effects still run after those moves commit.
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
    readonly eventWork?: Readonly<Record<string, AnySendWork>>;
    readonly $events?: TEvents;
  },
  options: GraphJourneyOptions<NoInfer<THandlers>, TPlugins, NoInfer<TStepId>> = {}
): GraphJourneyMachine<TContext, TStepId, TEvents, TMeta, TPlugins> {
  const { stepIds, steps, transitions } = normalizeGraphDefinition(
    definition as unknown as LooseGraphDefinition
  );

  if (options.startAt !== undefined && !(options.startAt in steps)) {
    throw new Error(`journey: startAt references unknown step "${options.startAt}"`);
  }

  // Explicit `startAt` wins over a persisted record; restore is best-effort.
  const restored =
    options.persist && options.startAt === undefined
      ? readRestorableState(options.persist, (id) => id in steps)
      : null;

  const runtime = new JourneyRuntime({
    kind: "graph",
    stepIds,
    steps,
    initial: definition.initial,
    ...(options.startAt !== undefined ? { startAt: options.startAt } : {}),
    initialContext: definition.context,
    ...(restored
      ? {
          restore: {
            context: restored.context,
            timeline: restored.timeline,
            currentIndex: restored.currentIndex
          }
        }
      : {}),
    transitions,
    ...(definition.eventWork !== undefined ? { eventWork: definition.eventWork } : {}),
    handlers: options.handlers ?? definition.handlers,
    autoStart: options.autoStart ?? false,
    defaultTimeoutMs: options.defaultTimeoutMs,
    ...(options.onListenerError !== undefined ? { onListenerError: options.onListenerError } : {}),
    plugins: [
      ...(options.persist ? [persistOptionToPlugin(options.persist)] : []),
      ...(options.plugins ?? [])
    ]
  });

  // `send(type, work)` and `send(type, payload)` are told apart structurally:
  // work is the only second argument carrying a `run` function.
  const isSendWork = (candidate: unknown): candidate is AnySendWork =>
    typeof candidate === "object" &&
    candidate !== null &&
    typeof (candidate as { run?: unknown }).run === "function";

  const machine = {
    ...buildMachineSurface(runtime),
    send: (type: string, payloadOrWork?: unknown, work?: AnySendWork) =>
      isSendWork(payloadOrWork)
        ? runtime.send(type, undefined, payloadOrWork)
        : runtime.send(type, payloadOrWork, work)
  };
  return machine as unknown as GraphJourneyMachine<
    TContext,
    TStepId,
    TEvents,
    TMeta,
    TPlugins,
    THandlers
  >;
}
