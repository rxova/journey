import { JourneyError } from "../core/errors";
import { eventWorkKey, hasOwn } from "../core/helpers";
import { buildMachineSurface } from "../core/machine";
import { JourneyRuntime } from "../core/runtime";
import { persistOptionToPlugin } from "../plugins/persistence/persistence";
import { readRestorableState } from "../plugins/persistence/persistence.helpers";
import type { RuntimeStep, RuntimeTransition } from "../core/runtime.types";
import type {
  GraphJourneyMachine,
  GraphJourneyOptions,
  GraphStepConfig,
  LooseGraphDefinition,
  LooseOnEntry,
  LooseTransition,
  MutableRuntimeStep,
  MutableRuntimeTransition
} from "./graph.types";
import type { AnySendWork } from "../core/runtime.types";
import type { Bag, GraphDefinition, HandlersOf, MetaOf } from "./bag.types";
import type {
  AnyJourneyPlugin,
  CompletePayloadOf,
  JourneyEventObject,
  JourneyTerminationPayloads,
  TerminatePayloadOf
} from "../core/types";

/**
 * Flattens each step's colocated `on` into the runtime's flat transition list,
 * in declaration order, and validates every target.
 *
 * Order is per step, then per event, then per candidate. That differs from the
 * old central map's global per-event order, but only for the same event
 * declared from two steps — and candidates are filtered by `from` before order
 * is consulted, so the selected edge is unchanged. `first-enabled-in-declared-
 * order` is asserted directly in graph.test.ts.
 *
 * `from` cannot dangle here: it is the key of the step that declares the entry.
 */
export function normalizeGraphDefinition(definition: LooseGraphDefinition): {
  stepIds: string[];
  steps: Record<string, RuntimeStep>;
  transitions: RuntimeTransition[];
  eventWork: Record<string, AnySendWork>;
} {
  const stepIds = Object.keys(definition.steps);
  if (stepIds.length === 0) {
    throw new JourneyError("empty-definition", "a graph journey needs at least one step");
  }
  if (!stepIds.includes(definition.initial)) {
    throw new JourneyError(
      "unknown-initial-step",
      `initial step "${definition.initial}" is not a declared step`,
      { stepId: definition.initial }
    );
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
  const eventWork: Record<string, AnySendWork> = {};

  const pushCandidate = (event: string, from: string, candidate: LooseTransition): void => {
    if (!stepIds.includes(candidate.to)) {
      throw new JourneyError(
        "dangling-transition",
        `transition "${event}" references unknown step "${candidate.to}"`,
        { event, stepId: candidate.to }
      );
    }
    const runtimeTransition: MutableRuntimeTransition = { event, from, to: candidate.to };
    if (candidate.when) runtimeTransition.when = candidate.when;
    if (candidate.onTransition) runtimeTransition.onTransition = candidate.onTransition;
    transitions.push(runtimeTransition);
  };

  for (const from of stepIds) {
    const on = definition.steps[from]?.on;
    if (!on) continue;
    for (const [event, entry] of Object.entries(on)) {
      if (entry === undefined) continue;
      if (typeof entry === "string") {
        pushCandidate(event, from, { to: entry });
        continue;
      }
      if (Array.isArray(entry)) {
        for (const candidate of entry) pushCandidate(event, from, candidate);
        continue;
      }
      const declared = entry as Exclude<LooseOnEntry, string | readonly LooseTransition[]>;
      eventWork[eventWorkKey(from, event)] = {
        run: declared.run,
        ...(declared.commit ? { commit: declared.commit } : {})
      };
      for (const candidate of declared.candidates) pushCandidate(event, from, candidate);
    }
  }

  return { stepIds, steps, transitions, eventWork };
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
  const TPlugins extends readonly AnyJourneyPlugin[] = readonly [],
  TTerminationPayloads extends JourneyTerminationPayloads = JourneyTerminationPayloads
>(
  // Inline shape (not GraphJourneyDefinition) so TStepId infers from the
  // steps-record keys alone: every other occurrence is NoInfer-wrapped,
  // otherwise `initial` would win inference and collapse the id union.
  definition: {
    readonly steps: Readonly<
      Record<
        TStepId,
        GraphStepConfig<
          NoInfer<TContext>,
          NoInfer<TStepId>,
          NoInfer<TEvents>,
          TMeta,
          NoInfer<THandlers>
        >
      >
    >;
    readonly initial: NoInfer<TStepId>;
    readonly context: TContext;
    readonly handlers?: THandlers;
    /** @internal Builder-produced; opaque by design (see GraphJourneyDefinition). */
    readonly eventWork?: Readonly<Record<string, unknown>>;
    readonly $events?: TEvents;
    readonly $payloads?: TTerminationPayloads;
  },
  options: GraphJourneyOptions<NoInfer<THandlers>, TPlugins, NoInfer<TStepId>> = {}
  // THandlers is load-bearing: it types `handlers` inside send work, which is
  // the only channel injected clients reach. Omitting it here let the
  // annotation win over the cast below and erased it to `unknown`.
): GraphJourneyMachine<
  TContext,
  TStepId,
  TEvents,
  TMeta,
  TPlugins,
  CompletePayloadOf<TTerminationPayloads>,
  TerminatePayloadOf<TTerminationPayloads>
> {
  const { stepIds, steps, transitions, eventWork } = normalizeGraphDefinition(
    definition as unknown as LooseGraphDefinition
  );

  if (options.startAt !== undefined && !hasOwn(steps, options.startAt)) {
    throw new JourneyError("unknown-step", `startAt references unknown step "${options.startAt}"`, {
      stepId: options.startAt
    });
  }

  // Explicit `startAt` wins over a persisted record; restore is best-effort.
  const restored =
    options.persist && options.startAt === undefined
      ? readRestorableState(options.persist, (id) => hasOwn(steps, id))
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
    ...(Object.keys(eventWork).length > 0 ? { eventWork } : {}),
    handlers: options.handlers ?? definition.handlers,
    autoStart: options.autoStart ?? true,
    defaultTimeoutMs: options.defaultTimeoutMs,
    ...(options.onListenerError !== undefined ? { onListenerError: options.onListenerError } : {}),
    plugins: [
      ...(options.persist ? [persistOptionToPlugin(options.persist)] : []),
      ...(options.plugins ?? [])
    ]
  });

  const machine = {
    ...buildMachineSurface(runtime),
    send: (type: string, payload?: unknown) => runtime.send(type, payload)
  };
  return machine as unknown as GraphJourneyMachine<
    TContext,
    TStepId,
    TEvents,
    TMeta,
    TPlugins,
    CompletePayloadOf<TTerminationPayloads>,
    TerminatePayloadOf<TTerminationPayloads>
  >;
}

/**
 * Creates a graph journey factory with its types pinned up front instead of
 * inferred.
 *
 * Reach for it when the definition cannot supply a type on its own —
 * `handlers`, a `meta` shape, or a `run` result, none of which sit at an
 * inference site — or when the same bag is shared by steps authored in
 * separate files. The definition is then *checked* against the bag rather than
 * read for types.
 *
 * ```ts
 * const login = withGraphTypes<AuthBag>()({
 *   initial: "login",
 *   context: initialContext,
 *   steps: { login: { on: { submit: "twofa" } }, twofa: {} }
 * });
 * ```
 *
 * Plain `createGraphJourney(definition)` stays the default: step ids infer from
 * the `steps` keys and event names from the `on` keys.
 */
export const withGraphTypes =
  <TBag extends Bag>() =>
  <const TPlugins extends readonly AnyJourneyPlugin[] = readonly []>(
    definition: GraphDefinition<TBag>,
    options: GraphJourneyOptions<HandlersOf<TBag>, TPlugins, TBag["stepId"]> = {}
  ): GraphJourneyMachine<TBag["context"], TBag["stepId"], TBag["events"], MetaOf<TBag>, TPlugins> =>
    createGraphJourney(
      definition as unknown as Parameters<typeof createGraphJourney>[0],
      options as unknown as Parameters<typeof createGraphJourney>[1]
    ) as unknown as GraphJourneyMachine<
      TBag["context"],
      TBag["stepId"],
      TBag["events"],
      MetaOf<TBag>,
      TPlugins
    >;
