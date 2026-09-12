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
  MutableRuntimeTransition,
  MutableSendWork
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
 * Both validators run at build time rather than at the first send. A label only
 * ever shows up in an error message and a timeout only ever fires under load,
 * so a malformed one would otherwise stay invisible until the moment it was
 * needed to explain something else.
 */
const assertLabel = (label: unknown, where: string, meta: { event: string; stepId: string }) => {
  if (typeof label !== "string" || label.length === 0) {
    throw new JourneyError(
      "invalid-label",
      `${where} must declare "label" as a non-empty string`,
      meta
    );
  }
  return label;
};

const assertTimeout = (ms: unknown, where: string, meta: { event: string; stepId: string }) => {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) {
    throw new JourneyError(
      "invalid-timeout",
      `${where} must declare "timeoutMs" as a finite number greater than 0`,
      meta
    );
  }
  return ms;
};

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

  const pushCandidate = (
    event: string,
    from: string,
    candidate: LooseTransition,
    index: number
  ): void => {
    if (!stepIds.includes(candidate.to)) {
      throw new JourneyError(
        "dangling-transition",
        `transition "${event}" references unknown step "${candidate.to}"`,
        { event, stepId: candidate.to }
      );
    }
    const where = `transition "${event}"[${index}] on step "${from}"`;
    const runtimeTransition: MutableRuntimeTransition = { event, from, to: candidate.to, index };
    if (candidate.when) runtimeTransition.when = candidate.when;
    if (candidate.onTransition) runtimeTransition.onTransition = candidate.onTransition;
    if (candidate.label !== undefined) {
      runtimeTransition.label = assertLabel(candidate.label, where, { event, stepId: from });
    }
    if (candidate.timeoutMs !== undefined) {
      runtimeTransition.timeoutMs = assertTimeout(candidate.timeoutMs, where, {
        event,
        stepId: from
      });
    }
    transitions.push(runtimeTransition);
  };

  for (const from of stepIds) {
    const on = definition.steps[from]?.on;
    if (!on) continue;
    for (const [event, entry] of Object.entries(on)) {
      if (entry === undefined) continue;
      if (typeof entry === "string") {
        pushCandidate(event, from, { to: entry }, 0);
        continue;
      }
      if (Array.isArray(entry)) {
        entry.forEach((candidate, index) => pushCandidate(event, from, candidate, index));
        continue;
      }
      const declared = entry as Exclude<LooseOnEntry, string | readonly LooseTransition[]>;
      const where = `work on "${event}" on step "${from}"`;
      const work: MutableSendWork = { run: declared.run };
      if (declared.commit) work.commit = declared.commit;
      if (declared.label !== undefined) {
        work.label = assertLabel(declared.label, where, { event, stepId: from });
      }
      if (declared.timeoutMs !== undefined) {
        work.timeoutMs = assertTimeout(declared.timeoutMs, where, { event, stepId: from });
      }
      eventWork[eventWorkKey(from, event)] = work;
      declared.candidates.forEach((candidate, index) =>
        pushCandidate(event, from, candidate, index)
      );
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
