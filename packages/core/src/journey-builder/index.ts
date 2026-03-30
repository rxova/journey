import type {
  JourneyDefinition,
  JourneyFullEventType,
  JourneyJsonObject,
  JourneyStepDefinition,
  JourneyTransitionGraph
} from "../types";
import type {
  JourneyBuilder,
  JourneyBuilderCandidate,
  JourneyBuilderOnEntry,
  JourneyBuilderTerminalCandidate,
  JourneyBuilderTerminalEntry,
  JourneyBuilderTerminalEventKey,
  JourneyBuilderStepEventKey,
  JourneyStepBuilder,
  JourneyToBuilder
} from "./types";

export type {
  JourneyBuilder,
  JourneyBuilderGuard,
  JourneyBuilderLifecycle,
  JourneyBuilderOnEntry,
  JourneyBuilderTerminalCandidate,
  JourneyBuilderTerminalEntry,
  JourneyBuilderUpdateContext,
  JourneyStepBuilder,
  JourneyToBuilder
} from "./types";

type RawCandidate = {
  readonly _to: string;
  readonly _when?: unknown;
  readonly _updateContext?: unknown;
  readonly _onEnter?: unknown;
  readonly _onLeave?: unknown;
  readonly _id?: string | undefined;
  readonly _timeoutMs?: number | undefined;
};

type RawTerminalCandidate = {
  readonly when?: unknown;
  readonly updateContext?: unknown;
  readonly onEnter?: unknown;
  readonly onLeave?: unknown;
  readonly id?: string | undefined;
  readonly timeoutMs?: number | undefined;
};

function makeToBuilder<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>,
  TEventType extends JourneyFullEventType<TEventMap>
>(
  candidate: JourneyBuilderCandidate<TContext, TStepId, TEventMap, THandlers, TEventType>
): JourneyToBuilder<TContext, TStepId, TEventMap, THandlers, TEventType> {
  return {
    _candidate: candidate,
    when(guard) {
      return makeToBuilder({ ...candidate, _when: guard });
    },
    updateContext(fn) {
      return makeToBuilder({ ...candidate, _updateContext: fn });
    },
    onEnter(fn) {
      return makeToBuilder({ ...candidate, _onEnter: fn });
    },
    onLeave(fn) {
      return makeToBuilder({ ...candidate, _onLeave: fn });
    },
    id(id) {
      return makeToBuilder({ ...candidate, _id: id });
    },
    timeoutMs(ms) {
      return makeToBuilder({ ...candidate, _timeoutMs: ms });
    }
  };
}

function candidateToEdge(c: RawCandidate): Record<string, unknown> {
  const edge: Record<string, unknown> = { to: c._to };
  if (c._when !== undefined) edge.when = c._when;
  if (c._updateContext !== undefined) edge.updateContext = c._updateContext;
  if (c._onEnter !== undefined) edge.onEnter = c._onEnter;
  if (c._onLeave !== undefined) edge.onLeave = c._onLeave;
  if (c._id !== undefined) edge.id = c._id;
  if (c._timeoutMs !== undefined) edge.timeoutMs = c._timeoutMs;
  return edge;
}

function terminalCandidateToEdge(c: RawTerminalCandidate): Record<string, unknown> {
  const edge: Record<string, unknown> = {};
  if (c.when !== undefined) edge.when = c.when;
  if (c.updateContext !== undefined) edge.updateContext = c.updateContext;
  if (c.onEnter !== undefined) edge.onEnter = c.onEnter;
  if (c.onLeave !== undefined) edge.onLeave = c.onLeave;
  if (c.id !== undefined) edge.id = c.id;
  if (c.timeoutMs !== undefined) edge.timeoutMs = c.timeoutMs;
  return edge;
}

/** Creates a typed builder for authoring journey definitions with `createStep`, `to`, and `build` helpers. */
export function createJourneyBuilder<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>
>(): JourneyBuilder<TContext, TStepId, TEventMap, TStepMeta, THandlers> {
  type WideNonTerminalEntry = JourneyBuilderOnEntry<
    TContext,
    TStepId,
    TEventMap,
    THandlers,
    JourneyBuilderStepEventKey<TEventMap>
  >;
  type WideTerminalEntry = JourneyBuilderTerminalEntry<
    TContext,
    TStepId,
    TEventMap,
    THandlers,
    JourneyBuilderTerminalEventKey<TEventMap>
  >;
  type BuilderWithCandidate = { readonly _candidate: RawCandidate };

  function to(stepId: TStepId): JourneyToBuilder<TContext, TStepId, TEventMap, THandlers> {
    return makeToBuilder({
      _to: stepId,
      _when: undefined,
      _updateContext: undefined,
      _onEnter: undefined,
      _onLeave: undefined,
      _id: undefined,
      _timeoutMs: undefined
    });
  }

  function resolveEntry(entry: WideNonTerminalEntry): readonly BuilderWithCandidate[] {
    if (typeof entry === "function") {
      const scopedTo = to as (
        stepId: TStepId
      ) => JourneyToBuilder<
        TContext,
        TStepId,
        TEventMap,
        THandlers,
        JourneyBuilderStepEventKey<TEventMap>
      >;
      return entry({ to: scopedTo });
    }

    return entry as readonly BuilderWithCandidate[];
  }

  function resolveTerminalEntry(entry: WideTerminalEntry): true | readonly unknown[] {
    if (entry === true || entry.length === 0) {
      return entry;
    }

    return (
      entry as readonly JourneyBuilderTerminalCandidate<
        TContext,
        TStepId,
        TEventMap,
        THandlers,
        JourneyBuilderTerminalEventKey<TEventMap>
      >[]
    ).map((candidate) => terminalCandidateToEdge(candidate));
  }

  function createStep<TStepKey extends TStepId>(
    id: TStepKey,
    config?: {
      meta?: TStepMeta;
      onEnter?: unknown;
      onLeave?: unknown;
      on?: Record<string, unknown>;
    }
  ) {
    return {
      _id: id,
      _meta: config?.meta,
      _onEnter: config?.onEnter,
      _onLeave: config?.onLeave,
      _on: config?.on
    } as JourneyStepBuilder<TContext, TStepId, TStepKey, TEventMap, TStepMeta, THandlers>;
  }

  function build(input: {
    initial: TStepId;
    context: TContext;
    handlers?: THandlers;
    steps: readonly JourneyStepBuilder<
      TContext,
      TStepId,
      TStepId,
      TEventMap,
      TStepMeta,
      THandlers
    >[];
    global?: {
      [key: string]: unknown;
    };
  }): JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers> {
    const stepsRecord = {} as Record<
      TStepId,
      JourneyStepDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>
    >;
    const transitionGraph = {} as Record<string, unknown>;

    for (const stepBuilder of input.steps) {
      stepsRecord[stepBuilder._id] = {
        ...(stepBuilder._meta !== undefined ? { meta: stepBuilder._meta } : {}),
        ...(stepBuilder._onEnter !== undefined ? { onEnter: stepBuilder._onEnter } : {}),
        ...(stepBuilder._onLeave !== undefined ? { onLeave: stepBuilder._onLeave } : {})
      };

      if (stepBuilder._on) {
        const stepTransitions: Record<string, unknown> = {};

        for (const [eventType, entry] of Object.entries(stepBuilder._on)) {
          if (!entry) continue;

          if (eventType === "completeJourney" || eventType === "terminateJourney") {
            stepTransitions[eventType] = resolveTerminalEntry(entry as WideTerminalEntry);
            continue;
          }

          const builders = resolveEntry(entry as WideNonTerminalEntry);
          stepTransitions[eventType] = builders.map((builder) =>
            candidateToEdge(builder._candidate)
          );
        }

        transitionGraph[stepBuilder._id] = stepTransitions;
      }
    }

    if (input.global) {
      const globalTransitions: Record<string, unknown> = {};

      for (const [eventType, value] of Object.entries(input.global)) {
        if (value === undefined) continue;

        if (eventType === "completeJourney" || eventType === "terminateJourney") {
          globalTransitions[eventType] = resolveTerminalEntry(value as WideTerminalEntry);
        } else if (Array.isArray(value)) {
          globalTransitions[eventType] = (
            value as readonly JourneyToBuilder<TContext, TStepId, TEventMap, THandlers>[]
          ).map((builder) => candidateToEdge(builder._candidate));
        }
      }

      transitionGraph.global = globalTransitions;
    }

    return {
      initial: input.initial,
      context: input.context,
      ...(input.handlers !== undefined ? { handlers: input.handlers } : {}),
      steps: stepsRecord,
      transitions: transitionGraph as JourneyTransitionGraph<
        TContext,
        TStepId,
        TEventMap,
        THandlers
      >
    };
  }

  return {
    createStep,
    to,
    build
  } as JourneyBuilder<TContext, TStepId, TEventMap, TStepMeta, THandlers>;
}
