import { withAbortSignal, withTimeout } from "@rxova/journey-common/async";
import {
  errorInDevelopment,
  isDevelopmentEnvironment,
  warnInDevelopment
} from "@rxova/journey-common/dev";
import { isPlainObject, isPromiseLike } from "@rxova/journey-common/predicates";

import {
  JourneyDefinitionError,
  JourneyDisposedError,
  JourneyStateError,
  JourneyTimeoutError
} from "./errors";

import type {
  JourneyBaseEvent,
  JourneyAsyncState,
  JourneyEvent,
  JourneyGoToEvent,
  JourneyJsonObject,
  JourneyJsonValue,
  JourneyPayloadFor,
  JourneyResolvedTransition,
  JourneySendEvent,
  JourneySendNoOpReason,
  JourneySendResult,
  JourneySnapshot,
  JourneySnapshotStateBase,
  JourneyStatus,
  JourneyStepAsyncState,
  JourneyTerminal,
  JourneyTransition,
  JourneyTransitionArgs
} from "../types";

export {
  errorInDevelopment,
  isDevelopmentEnvironment,
  isPlainObject,
  isPromiseLike,
  warnInDevelopment,
  withAbortSignal,
  withTimeout
};

/**
 * Namespace prefix for internal synthetic event types. Effect routing and
 * `after` timers reuse the serialized send pipeline by dispatching events under
 * this prefix; they are an implementation detail and are filtered out of the
 * public observation stream (see {@link isInternalEventType}).
 */
export const JOURNEY_INTERNAL_EVENT_PREFIX = "@@journey.";
/** Internal event type dispatched when a step effect resolves successfully. */
export const JOURNEY_EFFECT_RESOLVED_EVENT = `${JOURNEY_INTERNAL_EVENT_PREFIX}effect.resolved`;
/** Internal event type dispatched when a step effect rejects. */
export const JOURNEY_EFFECT_REJECTED_EVENT = `${JOURNEY_INTERNAL_EVENT_PREFIX}effect.rejected`;
/** Prefix for the internal event type dispatched when an `after` timer fires (suffixed with the delay). */
export const JOURNEY_AFTER_EVENT_PREFIX = `${JOURNEY_INTERNAL_EVENT_PREFIX}after:`;

/** True when an event type is an internal synthetic event (effect/after routing). */
export const isInternalEventType = (eventType: string): boolean =>
  eventType.startsWith(JOURNEY_INTERNAL_EVENT_PREFIX);

/**
 * Maps an event type to a public, label-safe form for structural output
 * (execution paths, diagnostics). Internal synthetic events lose their
 * `@@journey.` namespace — `@@journey.effect.resolved` → `effect.resolved`,
 * `@@journey.after:100` → `after:100`. Non-internal events are returned as-is.
 */
export const toPublicEventType = (eventType: string): string =>
  isInternalEventType(eventType)
    ? eventType.slice(JOURNEY_INTERNAL_EVENT_PREFIX.length)
    : eventType;

export const assertStepExists = <TStepId extends string>(
  steps: Record<TStepId, unknown>,
  stepId: TStepId,
  message: string
) => {
  if (!(stepId in steps)) {
    throw new JourneyDefinitionError("unknown-step", message);
  }
};

const cloneSerializableValue = <T extends JourneyJsonValue>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneSerializableValue(entry)) as T;
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        cloneSerializableValue(entryValue as JourneyJsonValue)
      ])
    ) as T;
  }

  return value;
};

type SerializableCheckState = {
  readonly seen: WeakSet<object>;
};

/* v8 ignore start -- only used for defensive error messages after JSON primitives have returned. */
const describeValue = (value: unknown): string => {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  if (typeof value === "object") {
    const constructorName = (value as { constructor?: { name?: string } }).constructor?.name;
    return constructorName && constructorName !== "Object" ? constructorName : "object";
  }

  return typeof value;
};
/* v8 ignore stop */

function assertSerializableValue(
  value: unknown,
  label: string,
  state: SerializableCheckState,
  path: readonly string[] = []
): asserts value is JourneyJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return;
  }

  const pathLabel = path.length === 0 ? label : `${label}.${path.join(".")}`;

  if (value === undefined) {
    throw new JourneyDefinitionError(
      "invalid-context",
      `${pathLabel} must be JSON-serializable. Received undefined.`
    );
  }

  if (typeof value === "bigint" || typeof value === "symbol" || typeof value === "function") {
    throw new JourneyDefinitionError(
      "invalid-context",
      `${pathLabel} must be JSON-serializable. Received ${typeof value}.`
    );
  }

  if (typeof value !== "object") {
    throw new JourneyDefinitionError(
      "invalid-context",
      `${pathLabel} must be JSON-serializable. Received ${describeValue(value)}.`
    );
  }

  if (state.seen.has(value)) {
    throw new JourneyDefinitionError(
      "invalid-context",
      `${pathLabel} must be JSON-serializable. Circular references are not supported.`
    );
  }

  state.seen.add(value);

  if (Array.isArray(value)) {
    for (const [index, entryValue] of value.entries()) {
      assertSerializableValue(entryValue, label, state, [...path, String(index)]);
    }
    return;
  }

  if (!isPlainObject(value)) {
    throw new JourneyDefinitionError(
      "invalid-context",
      `${pathLabel} must be JSON-serializable. Received non-plain ${describeValue(value)}.`
    );
  }

  for (const [key, entryValue] of Object.entries(value)) {
    assertSerializableValue(entryValue, label, state, [...path, key]);
  }
}

export function assertSerializableContext<TContext extends JourneyJsonObject>(
  context: TContext,
  label = "Journey context"
): TContext {
  assertSerializableValue(context, label, { seen: new WeakSet() });
  return context;
}

export const cloneContext = <TContext extends JourneyJsonObject>(context: TContext): TContext =>
  cloneSerializableValue(assertSerializableContext(context));

const cloneDefinitionValueFallback = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneDefinitionValueFallback(entry));
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (value instanceof Map) {
    return new Map(
      [...value.entries()].map(([key, entryValue]) => [
        cloneDefinitionValueFallback(key),
        cloneDefinitionValueFallback(entryValue)
      ])
    );
  }

  if (value instanceof Set) {
    return new Set([...value].map((entry) => cloneDefinitionValueFallback(entry)));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        cloneDefinitionValueFallback(entryValue)
      ])
    );
  }

  return value;
};

export const cloneMetaValue = <T>(value: T): T => {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) {
    return value;
  }

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      return cloneDefinitionValueFallback(value) as T;
    }
  } else {
    return cloneDefinitionValueFallback(value) as T;
  }
};

const freezeSnapshotValue = (value: unknown) => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      freezeSnapshotValue(item);
    }
    Object.freeze(value);
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const entryValue of Object.values(value)) {
    freezeSnapshotValue(entryValue);
  }
  Object.freeze(value);
};

export const normalizeStepCount = (steps?: number): number => {
  if (typeof steps !== "number" || !Number.isFinite(steps)) {
    return 1;
  }
  return Math.max(1, Math.trunc(steps));
};

export const now = (): number => Date.now();

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

const normalizeVisited = <TStepId extends string>(
  visited: Record<TStepId, boolean>,
  stepIds: readonly TStepId[]
): Record<TStepId, boolean> =>
  Object.fromEntries(stepIds.map((stepId) => [stepId, visited[stepId] === true])) as Record<
    TStepId,
    boolean
  >;

export const buildVisitedFromTimeline = <TStepId extends string>(
  timeline: readonly TStepId[],
  stepIds?: readonly TStepId[]
): Record<TStepId, boolean> => {
  const resolvedStepIds = stepIds ?? unique(timeline);
  const visited = Object.fromEntries(resolvedStepIds.map((stepId) => [stepId, false])) as Record<
    TStepId,
    boolean
  >;

  for (const stepId of timeline) {
    visited[stepId] = true;
  }

  return visited;
};

export const appendVisited = <TStepId extends string>(
  visited: Record<TStepId, boolean>,
  current: TStepId
): Record<TStepId, boolean> => ({
  ...visited,
  [current]: true
});

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const validateFiniteTimeout = (timeoutMs: unknown, label: string) => {
  if (timeoutMs !== undefined && !isFiniteNumber(timeoutMs)) {
    throw new JourneyDefinitionError(
      "invalid-timeout",
      `${label} must define a finite numeric "timeoutMs" when provided.`
    );
  }
};

export { JourneyDisposedError, JourneyTimeoutError };

export const buildIdleStepAsyncState = (): JourneyStepAsyncState => ({
  phase: "idle",
  eventType: null,
  transitionId: null,
  error: null
});

export const buildInitialAsyncState = <TStepId extends string>(
  steps: Record<TStepId, unknown>
): JourneyAsyncState<TStepId> => {
  const byStep = Object.fromEntries(
    Object.keys(steps).map((stepId) => [stepId, buildIdleStepAsyncState()])
  ) as Record<TStepId, JourneyStepAsyncState>;

  return {
    isLoading: false,
    byStep
  };
};

const isJourneyStatus = (value: unknown): value is JourneyStatus =>
  value === "idled" || value === "running" || value === "completed" || value === "terminated";

/**
 * Validates and resolves the `initialSnapshot` machine option into a full
 * runtime snapshot: the machine's own shape is stamped (any incoming
 * `type`/`stepOrder` is ignored — the definition is authoritative), `visited`
 * is filtered to known steps, async state is rebuilt fresh, and `status` is
 * preserved as given. Invalid input throws `JourneyDefinitionError` — this is
 * a programmer-supplied seam (dynamic-step transplant, tests, SSR resume), not
 * untrusted storage; storage coercion belongs to the persistence plugin.
 */
export const resolveInitialSnapshotOption = <
  TContext extends JourneyJsonObject,
  TStepId extends string
>(
  value: JourneySnapshotStateBase<JourneyJsonObject, string>,
  shape: JourneySnapshotShape<TStepId>,
  steps: Record<TStepId, unknown>
): JourneySnapshot<TContext, TStepId> => {
  const fail = (reason: string): never => {
    throw new JourneyDefinitionError(
      "invalid-initial-snapshot",
      `Journey "initialSnapshot" option is invalid: ${reason}`
    );
  };

  if (!isPlainObject(value) || !isPlainObject(value.history)) {
    fail("expected a snapshot state object with a history record.");
  }

  const timeline = value.history.timeline;
  if (!Array.isArray(timeline) || timeline.length === 0) {
    fail("history.timeline must be a non-empty array of step ids.");
  }
  for (const stepId of timeline as readonly string[]) {
    if (typeof stepId !== "string" || !(stepId in steps)) {
      fail(`history.timeline references unknown step "${String(stepId)}".`);
    }
  }

  const index = value.history.index;
  if (typeof index !== "number" || !Number.isFinite(index)) {
    fail("history.index must be a finite number.");
  }

  if (!isJourneyStatus(value.status)) {
    fail(`status "${String(value.status)}" is not a valid journey status.`);
  }

  const visitedSource = isPlainObject(value.visited) ? value.visited : {};
  const visited = Object.fromEntries(
    Object.keys(steps).map((stepId) => [stepId, visitedSource[stepId] === true])
  ) as Record<TStepId, boolean>;

  const visitsSource = (value as { visits?: unknown }).visits;
  const visits = isPlainObject(visitsSource)
    ? (visitsSource as Record<TStepId, number>)
    : undefined;

  return buildSnapshot(
    shape,
    timeline as unknown as readonly TStepId[],
    index,
    assertSerializableContext(value.context as TContext, "Journey initialSnapshot context"),
    value.status,
    buildInitialAsyncState(steps),
    visited,
    visits
  );
};

export const isGoToStepByIdEvent = <TStepId extends string, TEvents extends JourneyBaseEvent>(
  event: JourneySendEvent<TStepId, TEvents>
): event is JourneyGoToEvent<TStepId, JourneyPayloadFor<TEvents, "goToStepById">> =>
  event.type === "goToStepById" && "stepId" in event;

export const isTerminalTarget = <TStepId extends string>(
  target: TStepId | JourneyTerminal
): target is JourneyTerminal => target === "COMPLETE" || target === "TERMINATED";

export const resolveTransitionTarget = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent,
  THandlers extends Record<string, unknown>
>(
  transition: JourneyTransition<TContext, TStepId, TEvents, THandlers>
): TStepId | JourneyTerminal =>
  transition.event === "completeJourney"
    ? "COMPLETE"
    : transition.event === "terminateJourney"
      ? "TERMINATED"
      : (transition.to as TStepId | JourneyTerminal);

export const validateJourneyTransitions = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent,
  THandlers extends Record<string, unknown>
>(
  transitions: readonly JourneyResolvedTransition<TContext, TStepId, TEvents, THandlers>[],
  steps: Record<TStepId, unknown>
) => {
  const stepRegistry = steps as Record<string, unknown>;
  const allowedKeys = new Set([
    "from",
    "event",
    "to",
    "when",
    "updateContext",
    "onEnter",
    "onLeave",
    "id",
    "label",
    "timeoutMs"
  ]);

  for (const [index, transition] of transitions.entries()) {
    if (!transition || typeof transition !== "object") {
      throw new JourneyDefinitionError(
        "invalid-shape",
        `Journey transition at index ${index} must be an object.`
      );
    }

    for (const key of Object.keys(transition)) {
      if (!allowedKeys.has(key)) {
        throw new JourneyDefinitionError(
          "invalid-transition",
          `Journey transition at index ${index} contains unsupported field "${key}".`
        );
      }
    }

    if (typeof transition.from !== "string" || typeof transition.event !== "string") {
      throw new JourneyDefinitionError(
        "invalid-transition",
        `Journey transition at index ${index} must define string "from" and "event".`
      );
    }

    if (transition.from !== "*" && !(transition.from in stepRegistry)) {
      throw new JourneyDefinitionError(
        "unknown-step",
        `Journey transition at index ${index} references unknown from step "${transition.from}".`
      );
    }

    validateFiniteTimeout(transition.timeoutMs, `Journey transition at index ${index}`);

    if (transition.when !== undefined && typeof transition.when !== "function") {
      throw new JourneyDefinitionError(
        "invalid-transition",
        `Journey transition at index ${index} must define "when" as a function when provided.`
      );
    }

    if (transition.updateContext !== undefined && typeof transition.updateContext !== "function") {
      throw new JourneyDefinitionError(
        "invalid-transition",
        `Journey transition at index ${index} must define "updateContext" as a function when provided.`
      );
    }

    if (transition.onEnter !== undefined && typeof transition.onEnter !== "function") {
      throw new JourneyDefinitionError(
        "invalid-transition",
        `Journey transition at index ${index} must define "onEnter" as a function when provided.`
      );
    }

    if (transition.onLeave !== undefined && typeof transition.onLeave !== "function") {
      throw new JourneyDefinitionError(
        "invalid-transition",
        `Journey transition at index ${index} must define "onLeave" as a function when provided.`
      );
    }

    if (transition.id !== undefined && typeof transition.id !== "string") {
      throw new JourneyDefinitionError(
        "invalid-transition",
        `Journey transition at index ${index} must define "id" as a string when provided.`
      );
    }

    if (transition.label !== undefined && typeof transition.label !== "string") {
      throw new JourneyDefinitionError(
        "invalid-transition",
        `Journey transition at index ${index} must define "label" as a string when provided.`
      );
    }

    if (transition.event === "completeJourney" || transition.event === "terminateJourney") {
      if ("to" in transition && transition.to !== undefined) {
        throw new JourneyDefinitionError(
          "invalid-transition",
          `Journey transition at index ${index} with event "${transition.event}" cannot define "to".`
        );
      }
      continue;
    }

    if (typeof transition.to !== "string") {
      throw new JourneyDefinitionError(
        "invalid-transition",
        `Journey transition at index ${index} with event "${transition.event}" must define string "to".`
      );
    }

    if (!isTerminalTarget(transition.to) && !(transition.to in stepRegistry)) {
      throw new JourneyDefinitionError(
        "unknown-step",
        `Journey transition at index ${index} points to unknown step "${transition.to}".`
      );
    }
  }
};

export const buildSendResult = <TContext extends JourneyJsonObject, TStepId extends string>(
  snapshot: JourneySnapshot<TContext, TStepId>,
  transitioned: boolean,
  options: {
    transitionId?: string;
    label?: string;
    error?: unknown;
    noOpReason?: JourneySendNoOpReason;
  } = {}
): JourneySendResult<TContext, TStepId> => ({
  transitioned,
  ...(options.transitionId !== undefined ? { transitionId: options.transitionId } : {}),
  ...(options.label !== undefined ? { label: options.label } : {}),
  ...("error" in options ? { error: options.error } : {}),
  ...(options.noOpReason !== undefined ? { noOpReason: options.noOpReason } : {}),
  snapshot
});

/**
 * The variant-specific snapshot fields a machine stamps onto every snapshot it
 * builds: the `type` discriminator, plus `stepOrder` for the linear family.
 */
export type JourneySnapshotShape<TStepId extends string> =
  | { type: "graph" }
  | { type: "linear"; stepOrder: readonly TStepId[] };

/**
 * Derives the snapshot shape from a definition's `transitions` field: a linear
 * transitions array yields the linear shape (with its step order); a graph map
 * or absent transitions (headless) yields the graph shape.
 */
export const resolveSnapshotShape = <TStepId extends string>(
  transitions: unknown
): JourneySnapshotShape<TStepId> =>
  Array.isArray(transitions)
    ? {
        type: "linear",
        stepOrder: transitions.map((entry) =>
          typeof entry === "string" ? entry : (entry as { step: TStepId }).step
        ) as unknown as readonly TStepId[]
      }
    : { type: "graph" };

/** Extracts the shape carried by an existing snapshot, for derived rebuilds. */
export const snapshotShapeOf = <TContext extends JourneyJsonObject, TStepId extends string>(
  snapshot: JourneySnapshot<TContext, TStepId>
): JourneySnapshotShape<TStepId> =>
  snapshot.type === "linear"
    ? { type: "linear", stepOrder: snapshot.stepOrder }
    : { type: "graph" };

const applySnapshotShape = <TStepId extends string>(shape: JourneySnapshotShape<TStepId>) =>
  shape.type === "linear"
    ? ({ type: "linear", stepOrder: [...shape.stepOrder] } as const)
    : ({ type: "graph" } as const);

/**
 * Normalizes per-step visit counts over the given step ids. Missing counts
 * fall back to timeline occurrences, floored at 1 when `visited` marks the
 * step true (a visited step was entered at least once).
 */
export const normalizeVisits = <TStepId extends string>(
  stepIds: readonly TStepId[],
  timeline: readonly TStepId[],
  visits: Record<string, unknown> | undefined,
  visited: Record<TStepId, boolean> | undefined
): Record<TStepId, number> => {
  const timelineCounts = new Map<TStepId, number>();
  for (const stepId of timeline) {
    timelineCounts.set(stepId, (timelineCounts.get(stepId) ?? 0) + 1);
  }

  return Object.fromEntries(
    stepIds.map((stepId) => {
      const provided = visits?.[stepId];
      const fromTimeline = timelineCounts.get(stepId) ?? 0;
      const floor = visited?.[stepId] === true ? 1 : 0;
      const count =
        typeof provided === "number" && Number.isFinite(provided) && provided >= 0
          ? Math.trunc(provided)
          : fromTimeline;
      return [stepId, Math.max(count, floor)];
    })
  ) as Record<TStepId, number>;
};

export const buildSnapshot = <TContext extends JourneyJsonObject, TStepId extends string>(
  shape: JourneySnapshotShape<TStepId>,
  timeline: readonly TStepId[],
  index: number,
  context: TContext,
  status: JourneyStatus,
  asyncState: JourneyAsyncState<TStepId>,
  visited?: Record<TStepId, boolean>,
  visits?: Record<TStepId, number>
): JourneySnapshot<TContext, TStepId> => {
  if (timeline.length === 0) {
    throw new JourneyStateError("invalid-snapshot", "Journey timeline cannot be empty.");
  }

  const safeIndex = Math.max(0, Math.min(Math.trunc(index), timeline.length - 1));
  const currentStepId = timeline[safeIndex] as TStepId;
  const stepIds = unique(
    shape.type === "linear"
      ? ([...shape.stepOrder, ...timeline] as const)
      : visited
        ? ([...(Object.keys(visited) as TStepId[]), ...timeline] as const)
        : timeline
  );

  // Linear invariant: visited[id] === visits[id] > 0. Counts win when given;
  // otherwise they derive from the timeline (floored by `visited`).
  const resolvedVisits =
    shape.type === "linear" ? normalizeVisits(stepIds, timeline, visits, visited) : undefined;
  const resolvedVisited = resolvedVisits
    ? (Object.fromEntries(
        stepIds.map((stepId) => [stepId, (resolvedVisits[stepId] ?? 0) > 0])
      ) as Record<TStepId, boolean>)
    : visited
      ? normalizeVisited(visited, stepIds)
      : buildVisitedFromTimeline(timeline, stepIds);

  return {
    ...applySnapshotShape(shape),
    ...(resolvedVisits !== undefined ? { visits: resolvedVisits } : {}),
    status,
    currentStepId,
    history: {
      timeline: [...timeline],
      index: safeIndex
    },
    context: cloneContext(context),
    visited: resolvedVisited,
    async: cloneSerializableValue(
      asyncState as unknown as JourneyJsonValue
    ) as JourneyAsyncState<TStepId>
  } as JourneySnapshot<TContext, TStepId>;
};

export const stabilizeSnapshot = <TContext extends JourneyJsonObject, TStepId extends string>(
  snapshot: JourneySnapshot<TContext, TStepId>
): JourneySnapshot<TContext, TStepId> => {
  const stableSnapshot: JourneySnapshot<TContext, TStepId> = {
    ...snapshot,
    ...applySnapshotShape(snapshotShapeOf(snapshot)),
    ...(snapshot.type === "linear" ? { visits: { ...snapshot.visits } } : {}),
    history: {
      timeline: [...snapshot.history.timeline],
      index: snapshot.history.index
    },
    context: cloneContext(snapshot.context),
    visited: { ...snapshot.visited },
    async: cloneSerializableValue(
      snapshot.async as unknown as JourneyJsonValue
    ) as JourneyAsyncState<TStepId>
  } as JourneySnapshot<TContext, TStepId>;

  freezeSnapshotValue(stableSnapshot);
  return stableSnapshot;
};

export const selectTransition = async <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent,
  THandlers extends Record<string, unknown>,
  TTransition extends {
    from: TStepId | "*";
    event: string;
    when?: (
      args: JourneyTransitionArgs<TContext, TStepId, TEvents, THandlers>
    ) => boolean | Promise<boolean>;
    timeoutMs?: number;
    id?: string;
    label?: string;
  }
>(
  transitions: readonly TTransition[],
  snapshot: JourneySnapshot<TContext, TStepId>,
  event: JourneyEvent<TStepId, TEvents>,
  signal: AbortSignal,
  handlers: THandlers,
  hooks?: {
    onAsyncGuardStart?: (transition: TTransition) => void;
    onAsyncGuardSuccess?: (transition: TTransition) => void;
    onAsyncGuardError?: (transition: TTransition, error: unknown) => void;
  },
  defaultTimeoutMs?: number
): Promise<TTransition | null> => {
  for (const transition of transitions) {
    const fromMatches = transition.from === "*" || transition.from === snapshot.currentStepId;
    const eventMatches = transition.event === event.type;

    if (!fromMatches || !eventMatches) {
      continue;
    }

    if (!transition.when) {
      return transition;
    }

    let guardResult: boolean | Promise<boolean>;
    if (signal.aborted) {
      throw signal.reason;
    }

    guardResult = (
      transition.when as (
        args: JourneyTransitionArgs<TContext, TStepId, TEvents, THandlers>
      ) => boolean | Promise<boolean>
    )({
      snapshot,
      context: snapshot.context,
      from: snapshot.currentStepId,
      timeline: snapshot.history.timeline,
      index: snapshot.history.index,
      event,
      signal,
      handlers
    });

    const asyncGuard = isPromiseLike(guardResult);
    const asyncGuardPromise = asyncGuard ? (guardResult as PromiseLike<boolean>) : null;

    let allowed: boolean;
    try {
      if (asyncGuard) {
        hooks?.onAsyncGuardStart?.(transition);
        allowed = await withTimeout(
          withAbortSignal(asyncGuardPromise as PromiseLike<boolean>, signal),
          transition.timeoutMs ?? defaultTimeoutMs,
          () =>
            new JourneyTimeoutError(
              `Transition guard timed out after ${transition.timeoutMs ?? defaultTimeoutMs}ms (event: ${event.type}, transition: ${transition.id ?? "<anonymous>"}).`
            )
        );
      } else {
        allowed = guardResult as boolean;
      }
    } catch (error) {
      if (asyncGuard) {
        hooks?.onAsyncGuardError?.(transition, error);
      }
      throw error;
    }

    if (asyncGuard) {
      hooks?.onAsyncGuardSuccess?.(transition);
    }

    if (allowed) {
      return transition;
    }
  }

  return null;
};

export const transitionSnapshot = <TContext extends JourneyJsonObject, TStepId extends string>(
  snapshot: JourneySnapshot<TContext, TStepId>,
  nextCurrent: TStepId,
  nextContext: TContext
): JourneySnapshot<TContext, TStepId> => {
  const baseTimeline = snapshot.history.timeline.slice(0, snapshot.history.index + 1);
  let nextTimeline = baseTimeline;
  if (nextCurrent !== snapshot.currentStepId) {
    nextTimeline = [...baseTimeline, nextCurrent];
  }

  const nextIndex = nextTimeline.length - 1;
  const visited = appendVisited(snapshot.visited, nextCurrent);

  return buildSnapshot(
    snapshotShapeOf(snapshot),
    nextTimeline,
    nextIndex,
    nextContext,
    snapshot.status,
    snapshot.async,
    visited
  );
};
