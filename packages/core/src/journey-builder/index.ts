import type {
  JourneyFullEventType,
  JourneyStepDefinition,
  JourneyTransitionGraph,
  JourneyTypes,
  JourneyTypesInput,
  ResolveJourneyTypes
} from "../types";
import type {
  JourneyBuilder,
  JourneyBuilderCustomEventKey,
  JourneyBuilderDefinition,
  JourneyBuilderCandidate,
  JourneyBuilderGuard,
  JourneyBuilderLifecycle,
  JourneyBuilderOnEntry,
  JourneyBuilderTerminalCandidate,
  JourneyBuilderTerminalEntry,
  JourneyBuilderTerminalEventKey,
  JourneyBuilderUpdateContext,
  JourneyBuilderStepEventKey,
  JourneyStepBuilder,
  JourneyToBuilder,
  JourneyToBuilderUnused,
  JourneyToBuilderUsage
} from "./types";

export type {
  JourneyBuilder,
  JourneyBuilderCustomEventKey,
  JourneyBuilderDefinition,
  JourneyBuilderDefinitionMetadata,
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
  readonly _label?: string | undefined;
  readonly _timeoutMs?: number | undefined;
};

type RawTerminalCandidate = {
  readonly when?: unknown;
  readonly updateContext?: unknown;
  readonly onEnter?: unknown;
  readonly onLeave?: unknown;
  readonly label?: string | undefined;
  readonly timeoutMs?: number | undefined;
};

function makeToBuilder<
  T extends JourneyTypes,
  TEventType extends JourneyFullEventType<T["events"]>,
  TUsed extends JourneyToBuilderUsage = JourneyToBuilderUnused
>(candidate: JourneyBuilderCandidate<T, TEventType>): JourneyToBuilder<T, TEventType, TUsed> {
  return {
    _candidate: candidate,
    when(guard: JourneyBuilderGuard<T, TEventType>) {
      return makeToBuilder<T, TEventType, Omit<TUsed, "when"> & { readonly when: true }>({
        ...candidate,
        _when: guard
      });
    },
    updateContext(fn: JourneyBuilderUpdateContext<T, TEventType>) {
      return makeToBuilder<
        T,
        TEventType,
        Omit<TUsed, "updateContext"> & { readonly updateContext: true }
      >({ ...candidate, _updateContext: fn });
    },
    onEnter(fn: JourneyBuilderLifecycle<T>) {
      return makeToBuilder<T, TEventType, Omit<TUsed, "onEnter"> & { readonly onEnter: true }>({
        ...candidate,
        _onEnter: fn
      });
    },
    onLeave(fn: JourneyBuilderLifecycle<T>) {
      return makeToBuilder<T, TEventType, Omit<TUsed, "onLeave"> & { readonly onLeave: true }>({
        ...candidate,
        _onLeave: fn
      });
    },
    label(label: string) {
      return makeToBuilder<T, TEventType, Omit<TUsed, "label"> & { readonly label: true }>({
        ...candidate,
        _label: label
      });
    },
    timeoutMs(ms: number) {
      return makeToBuilder<T, TEventType, Omit<TUsed, "timeoutMs"> & { readonly timeoutMs: true }>({
        ...candidate,
        _timeoutMs: ms
      });
    }
  } as JourneyToBuilder<T, TEventType, TUsed>;
}

function candidateToEdge(c: RawCandidate): Record<string, unknown> {
  const edge: Record<string, unknown> = { to: c._to };
  if (c._when !== undefined) edge.when = c._when;
  if (c._updateContext !== undefined) edge.updateContext = c._updateContext;
  if (c._onEnter !== undefined) edge.onEnter = c._onEnter;
  if (c._onLeave !== undefined) edge.onLeave = c._onLeave;
  if (c._label !== undefined) edge.label = c._label;
  if (c._timeoutMs !== undefined) edge.timeoutMs = c._timeoutMs;
  return edge;
}

function terminalCandidateToEdge(c: RawTerminalCandidate): Record<string, unknown> {
  const edge: Record<string, unknown> = {};
  if (c.when !== undefined) edge.when = c.when;
  if (c.updateContext !== undefined) edge.updateContext = c.updateContext;
  if (c.onEnter !== undefined) edge.onEnter = c.onEnter;
  if (c.onLeave !== undefined) edge.onLeave = c.onLeave;
  if (c.label !== undefined) edge.label = c.label;
  if (c.timeoutMs !== undefined) edge.timeoutMs = c.timeoutMs;
  return edge;
}

/**
 * Creates a typed builder for authoring journey definitions with `createStep`,
 * `to`, and `build` helpers. The journey's types are supplied as a single
 * bundle object: `createGraphJourneyBuilder<{ context; stepId; events; … }>()`.
 */
export function createGraphJourneyBuilder<
  TInput extends JourneyTypesInput = JourneyTypesInput
>(): JourneyBuilder<ResolveJourneyTypes<TInput>> {
  type T = ResolveJourneyTypes<TInput>;
  type WideNonTerminalEntry = JourneyBuilderOnEntry<T, JourneyBuilderStepEventKey<T["events"]>>;
  type WideTerminalEntry = JourneyBuilderTerminalEntry<
    T,
    JourneyBuilderTerminalEventKey<T["events"]>
  >;
  type BuilderWithCandidate = { readonly _candidate: RawCandidate };

  function to(stepId: T["stepId"]): JourneyToBuilder<T> {
    return makeToBuilder({
      _to: stepId,
      _when: undefined,
      _updateContext: undefined,
      _onEnter: undefined,
      _onLeave: undefined,
      _label: undefined,
      _timeoutMs: undefined
    });
  }

  function resolveEntry(entry: WideNonTerminalEntry): readonly BuilderWithCandidate[] {
    if (typeof entry === "function") {
      const scopedTo = to as (
        stepId: T["stepId"]
      ) => JourneyToBuilder<T, JourneyBuilderStepEventKey<T["events"]>>;
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
        T,
        JourneyBuilderTerminalEventKey<T["events"]>
      >[]
    ).map((candidate) => terminalCandidateToEdge(candidate));
  }

  function createStep<TStepKey extends T["stepId"]>(
    id: TStepKey,
    config?: {
      meta?: T["meta"];
      onEnter?: unknown;
      onLeave?: unknown;
      on?: Record<string, unknown>;
      effect?: unknown;
      after?: unknown;
    }
  ) {
    return {
      id,
      _meta: config?.meta,
      _onEnter: config?.onEnter,
      _onLeave: config?.onLeave,
      _on: config?.on,
      _effect: config?.effect,
      _after: config?.after
    } as JourneyStepBuilder<T, TStepKey, JourneyBuilderCustomEventKey<T["events"]>>;
  }

  function build(input: {
    initial: T["stepId"];
    context: T["context"];
    handlers?: T["handlers"];
    steps: readonly JourneyStepBuilder<T, T["stepId"], JourneyBuilderCustomEventKey<T["events"]>>[];
    global?: {
      [key: string]: unknown;
    };
  }): JourneyBuilderDefinition<T> {
    const stepsRecord = {} as Record<
      T["stepId"],
      JourneyStepDefinition<T["context"], T["stepId"], T["events"], T["meta"], T["handlers"]>
    >;
    const transitionGraph = {} as Record<string, unknown>;

    for (const stepBuilder of input.steps) {
      stepsRecord[stepBuilder.id] = {
        ...(stepBuilder._meta !== undefined ? { meta: stepBuilder._meta } : {}),
        ...(stepBuilder._onEnter !== undefined ? { onEnter: stepBuilder._onEnter } : {}),
        ...(stepBuilder._onLeave !== undefined ? { onLeave: stepBuilder._onLeave } : {}),
        ...(stepBuilder._effect !== undefined ? { effect: stepBuilder._effect } : {}),
        ...(stepBuilder._after !== undefined ? { after: stepBuilder._after } : {})
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

        transitionGraph[stepBuilder.id] = stepTransitions;
      }
    }

    if (input.global) {
      const globalTransitions: Record<string, unknown> = {};

      for (const [eventType, value] of Object.entries(input.global)) {
        if (value === undefined) continue;

        if (eventType === "completeJourney" || eventType === "terminateJourney") {
          globalTransitions[eventType] = resolveTerminalEntry(value as WideTerminalEntry);
        } else if (Array.isArray(value)) {
          globalTransitions[eventType] = (value as readonly JourneyToBuilder<T>[]).map((builder) =>
            candidateToEdge(builder._candidate)
          );
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
        T["context"],
        T["stepId"],
        T["events"],
        T["handlers"]
      >
    } as JourneyBuilderDefinition<T>;
  }

  return {
    createStep,
    to,
    build
  } as unknown as JourneyBuilder<T>;
}
