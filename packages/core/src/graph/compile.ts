import { JourneyError } from "../core/errors";
import { eventWorkKey, hasOwn, toStructure } from "../core/helpers";
import type { AnySendWork, RuntimeStep, RuntimeTransition } from "../core/runtime.types";
import type {
  GraphDefinitionInput,
  GraphStepConfig,
  LooseGraphDefinition,
  LooseOnEntry,
  LooseTransition,
  MutableRuntimeStep,
  MutableRuntimeTransition,
  MutableSendWork,
} from "./graph.types";
import type {
  JourneyEventObject,
  JourneyStructure,
  JourneyTerminationPayloads,
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
      meta,
    );
  }
  return label;
};

const assertTimeout = (ms: unknown, where: string, meta: { event: string; stepId: string }) => {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) {
    throw new JourneyError(
      "invalid-timeout",
      `${where} must declare "timeoutMs" as a finite number greater than 0`,
      meta,
    );
  }
  return ms;
};

/**
 * Where the runtime payload hangs off a compiled graph.
 *
 * `Symbol()`, not `Symbol.for()`: a registry key is global, so two copies of
 * this package in one app would read each other's payloads. A module-scoped
 * symbol also keeps the payload off `Object.keys`, out of `JSON.stringify`,
 * and off the normal read paths — the intended door to the runtime data is
 * {@link runtimeOf}, which is not exported from the package.
 *
 * This is privacy, not tamper-proofing: `Object.getOwnPropertySymbols` still
 * reaches the key. {@link runtimeOf} therefore checks the payload's shape
 * rather than trusting it, so a hand-made object cannot route a machine onto a
 * step the definition never declared.
 */
const RUNTIME: unique symbol = Symbol("compiled");

/** A compiled graph with its type parameters erased, for the read sites that do not need them. */
export type AnyCompiledGraph = {
  readonly structure: JourneyStructure;
  /**
   * @internal Opaque runtime payload, typed `unknown` so `RuntimeStep` and
   * `RuntimeTransition` never enter the public type graph.
   */
  readonly [RUNTIME]: unknown;
};

/** The result of {@link compileGraph}: an inert structure view plus an opaque runtime payload. */
export type CompiledGraph<
  TContext = unknown,
  TStepId extends string = string,
  TEvents extends JourneyEventObject = JourneyEventObject,
  THandlers = unknown,
  TMeta = Record<string, unknown>,
  TTerminationPayloads extends JourneyTerminationPayloads = JourneyTerminationPayloads,
> = AnyCompiledGraph & {
  /**
   * Phantom type carrier — never set at runtime. It rides on a plain property
   * rather than on the alias itself so the types survive a spread: a copy of a
   * compiled graph is still a compiled graph.
   */
  readonly $graph?: {
    readonly context: TContext;
    readonly stepId: TStepId;
    readonly events: TEvents;
    readonly handlers: THandlers;
    readonly stepMeta: TMeta;
    readonly payloads: TTerminationPayloads;
  };
};

/** Narrows a definition to one already through {@link compileGraph}. */
const isCompiled = (value: object): value is AnyCompiledGraph => RUNTIME in value;

/** Everything the runtime needs, carried under {@link RUNTIME} and nowhere else. */
type CompiledRuntime = {
  readonly stepIds: string[];
  readonly steps: Record<string, RuntimeStep>;
  readonly transitions: RuntimeTransition[];
  readonly eventWork: Record<string, AnySendWork>;
  readonly initial: string;
  readonly context: unknown;
  readonly handlers: unknown;
};

/**
 * Validates and flattens a graph definition once, up front.
 *
 * Every factory compiles its definition anyway; doing it explicitly means the
 * cost is paid once for a definition that starts several machines, errors in
 * the definition surface here rather than at construction, and `structure` —
 * the same read-only view plugins and `analyzeStructure` see — is available
 * without starting anything.
 *
 * The result is frozen and inert. Its runtime payload lives behind a private
 * symbol, so it survives a spread but never shows up in `Object.keys` or
 * `JSON.stringify`, and nothing internal leaks into the public types.
 *
 * ```ts
 * const compiled = compileGraph(definition);
 * console.log(compiled.structure.stepIds);
 * const machine = createGraphJourney(compiled);
 * ```
 *
 * Flattening is per step, then per event, then per candidate. That differs
 * from the old central map's global per-event order, but only for the same
 * event declared from two steps — and candidates are filtered by `from` before
 * order is consulted, so the selected edge is unchanged.
 * `first-enabled-in-declared-order` is asserted directly in graph.test.ts.
 *
 * A transition's `from` cannot dangle: it is the key of the step that declares
 * the entry.
 *
 * @throws JourneyError when the definition declares no steps, names an unknown
 * `initial`, points a transition at an undeclared step, or declares an invalid
 * `label` or `timeoutMs`.
 */
export function compileGraph<
  TContext,
  TStepId extends string,
  TEvents extends JourneyEventObject = JourneyEventObject,
  THandlers = unknown,
  TMeta = Record<string, unknown>,
  TTerminationPayloads extends JourneyTerminationPayloads = JourneyTerminationPayloads,
>(
  input: GraphDefinitionInput<TContext, TStepId, TEvents, THandlers, TMeta, TTerminationPayloads>,
): CompiledGraph<TContext, TStepId, TEvents, THandlers, TMeta, TTerminationPayloads> {
  const definition = input as unknown as LooseGraphDefinition;
  const stepIds = Object.keys(definition.steps);
  if (stepIds.length === 0) {
    throw new JourneyError("empty-definition", "a graph journey needs at least one step");
  }
  // A Set, not `stepIds.includes`: every transition target is checked against
  // it, so a linear scan per edge makes validation quadratic in a wide graph.
  const declared = new Set(stepIds);
  if (!declared.has(definition.initial)) {
    throw new JourneyError(
      "unknown-initial-step",
      `initial step "${definition.initial}" is not a declared step`,
      { stepId: definition.initial },
    );
  }

  // Null-prototype: a step id of `__proto__` would otherwise be a prototype
  // assignment rather than an entry, leaving an id in `stepIds` with no step
  // behind it. Same reasoning as `hasOwn` in core/helpers.
  const steps: Record<string, RuntimeStep> = Object.create(null) as Record<string, RuntimeStep>;
  for (const id of stepIds) {
    const config = definition.steps[id] as GraphStepConfig;
    const runtimeStep: MutableRuntimeStep = { stepMeta: config.stepMeta ?? {} };
    if (config.onEnter) {
      runtimeStep.onEnter = config.onEnter as unknown as NonNullable<RuntimeStep["onEnter"]>;
    }
    if (config.onLeave) {
      runtimeStep.onLeave = config.onLeave as unknown as NonNullable<RuntimeStep["onLeave"]>;
    }
    steps[id] = runtimeStep;
  }

  const transitions: RuntimeTransition[] = [];
  const eventWork: Record<string, AnySendWork> = Object.create(null) as Record<string, AnySendWork>;

  const pushCandidate = (
    event: string,
    from: string,
    candidate: LooseTransition,
    index: number,
  ): void => {
    if (!declared.has(candidate.to)) {
      throw new JourneyError(
        "dangling-transition",
        `transition "${event}" references unknown step "${candidate.to}"`,
        { event, stepId: candidate.to },
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
        stepId: from,
      });
    }
    // Conditional, like `label` and `timeoutMs`: a definition that declares no
    // edge meta produces transitions with no `edgeMeta` key at all.
    if (candidate.edgeMeta !== undefined) runtimeTransition.edgeMeta = candidate.edgeMeta;
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
        (entry as readonly LooseTransition[]).forEach((candidate, index) =>
          pushCandidate(event, from, candidate, index),
        );
        continue;
      }
      const declaredWork = entry as Exclude<LooseOnEntry, string | readonly LooseTransition[]>;
      const where = `work on "${event}" on step "${from}"`;
      const work: MutableSendWork = { run: declaredWork.run };
      if (declaredWork.commit) work.commit = declaredWork.commit;
      if (declaredWork.label !== undefined) {
        work.label = assertLabel(declaredWork.label, where, { event, stepId: from });
      }
      if (declaredWork.timeoutMs !== undefined) {
        work.timeoutMs = assertTimeout(declaredWork.timeoutMs, where, { event, stepId: from });
      }
      eventWork[eventWorkKey(from, event)] = work;
      declaredWork.candidates.forEach((candidate, index) =>
        pushCandidate(event, from, candidate, index),
      );
    }
  }

  const { initial, context, handlers } = definition;
  // A compiled graph is shared across every machine built from it, so the
  // payload is frozen too: without this, one machine's plugin could add an
  // `onEnter` that every later machine would run.
  for (const step of Object.values(steps)) Object.freeze(step);
  for (const transition of transitions) Object.freeze(transition);
  Object.freeze(steps);
  Object.freeze(transitions);
  Object.freeze(eventWork);
  return Object.freeze({
    structure: toStructure({ kind: "graph", stepIds, steps, initial, transitions }),
    [RUNTIME]: Object.freeze({
      stepIds,
      steps,
      transitions,
      eventWork,
      initial,
      context,
      handlers,
    }),
  });
}

/**
 * @internal Reads the runtime payload back out, checking its shape first.
 *
 * The marker symbol is reachable through `Object.getOwnPropertySymbols`, so the
 * payload is untrusted input: without this check a hand-made object routes a
 * machine onto a step the definition never declared. Two copies of this package
 * in one app also land here, because each has its own marker.
 */
export const runtimeOf = (compiled: AnyCompiledGraph): CompiledRuntime => {
  const payload = compiled[RUNTIME] as Partial<CompiledRuntime> | undefined;
  const usable =
    payload !== null &&
    typeof payload === "object" &&
    Array.isArray(payload.stepIds) &&
    Array.isArray(payload.transitions) &&
    typeof payload.steps === "object" &&
    payload.steps !== null &&
    typeof payload.initial === "string" &&
    hasOwn(payload.steps, payload.initial) &&
    payload.transitions.every(
      (transition) =>
        hasOwn(payload.steps as object, transition.from) &&
        hasOwn(payload.steps as object, transition.to),
    );
  if (!usable) {
    throw new JourneyError(
      "invalid-compiled-graph",
      "compiled graph payload is unusable: build it with compileGraph, and check for two copies of @rxova/journey-core in one app",
    );
  }
  return payload as CompiledRuntime;
};

/** @internal Accepts either side of the union a factory takes and yields the compiled form. */
export const ensureCompiled = (definition: object): AnyCompiledGraph =>
  isCompiled(definition) ? definition : compileGraph(definition as unknown as LooseGraphDefinition);
