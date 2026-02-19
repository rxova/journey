import { JOURNEY_ASYNC_PHASE, JOURNEY_EVENT, JOURNEY_WILDCARD } from "./types";
import type {
  JourneyAsyncState,
  JourneyEvent,
  JourneyEventPayloadMap,
  JourneyGoToEvent,
  JourneyPayloadFor,
  JourneySendResult,
  JourneySnapshot,
  JourneyStatus,
  JourneyStepAsyncState,
  JourneyTerminal,
  JourneyTransition
} from "./types";

export const assertStepExists = <TStepId extends string>(
  steps: Record<TStepId, unknown>,
  stepId: TStepId,
  message: string
) => {
  if (!(stepId in steps)) {
    throw new Error(message);
  }
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

export const isPromiseLike = <T>(value: T | PromiseLike<T>): value is PromiseLike<T> =>
  typeof value === "object" &&
  value !== null &&
  "then" in value &&
  typeof (value as { then: unknown }).then === "function";

export const buildIdleStepAsyncState = (): JourneyStepAsyncState => ({
  phase: JOURNEY_ASYNC_PHASE.IDLE,
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

export const isGoToStepByIdEvent = <
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
>(
  event: JourneyEvent<TStepId, TEventType, TPayloadMap>
): event is JourneyGoToEvent<
  TStepId,
  JourneyPayloadFor<TEventType, TPayloadMap, (typeof JOURNEY_EVENT)["GO_TO_STEP_BY_ID"]>
> => event.type === JOURNEY_EVENT.GO_TO_STEP_BY_ID && "stepId" in event;

export const isTerminalTarget = <TStepId extends string>(
  target: TStepId | JourneyTerminal
): target is JourneyTerminal => target === "COMPLETE" || target === "TERMINATED";

export const validateJourneyTransitions = <
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
>(
  transitions: readonly JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>[],
  steps: Record<TStepId, unknown>
) => {
  const stepRegistry = steps as Record<string, unknown>;

  for (const [index, transition] of transitions.entries()) {
    if (!transition || typeof transition !== "object") {
      throw new Error(`Journey transition at index ${index} must be an object.`);
    }

    if (typeof transition.from !== "string" || typeof transition.event !== "string") {
      throw new Error(
        `Journey transition at index ${index} must define string "from" and "event".`
      );
    }

    if (transition.from !== JOURNEY_WILDCARD && !(transition.from in stepRegistry)) {
      throw new Error(
        `Journey transition at index ${index} references unknown from step "${transition.from}".`
      );
    }

    if (transition.event === "completeJourney" || transition.event === "terminateJourney") {
      if ("to" in transition && transition.to !== undefined) {
        throw new Error(
          `Journey transition at index ${index} with event "${transition.event}" cannot define "to".`
        );
      }
      continue;
    }

    if (typeof transition.to !== "string") {
      throw new Error(
        `Journey transition at index ${index} with event "${transition.event}" must define string "to".`
      );
    }

    if (!isTerminalTarget(transition.to) && !(transition.to in stepRegistry)) {
      throw new Error(
        `Journey transition at index ${index} points to unknown step "${transition.to}".`
      );
    }
  }
};

export const buildSendResult = <TContext, TStepId extends string, TStepMeta>(
  snapshot: JourneySnapshot<TContext, TStepId, TStepMeta>,
  transitioned: boolean,
  transitionId?: string
): JourneySendResult<TContext, TStepId, TStepMeta> =>
  transitionId ? { transitioned, transitionId, snapshot } : { transitioned, snapshot };

export const buildSnapshot = <TContext, TStepId extends string, TStepMeta>(
  timeline: readonly TStepId[],
  index: number,
  context: TContext,
  status: JourneyStatus,
  asyncState: JourneyAsyncState<TStepId>,
  stepMeta: Record<TStepId, TStepMeta>,
  visited?: Record<TStepId, boolean>
): JourneySnapshot<TContext, TStepId, TStepMeta> => {
  if (timeline.length === 0) {
    throw new Error("Journey timeline cannot be empty.");
  }
  const safeIndex = Math.max(0, Math.min(Math.trunc(index), timeline.length - 1));
  const currentStepId = timeline[safeIndex] as TStepId;
  const stepIds = Object.keys(stepMeta) as TStepId[];
  return {
    status,
    currentStepId,
    history: {
      timeline: [...timeline],
      index: safeIndex
    },
    context,
    visited: visited
      ? normalizeVisited(visited, stepIds)
      : buildVisitedFromTimeline(timeline, stepIds),
    stepMeta: { ...stepMeta },
    async: asyncState
  };
};

export const selectTransition = async <
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>,
  TStepMeta
>(
  transitions: readonly JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>[],
  snapshot: JourneySnapshot<TContext, TStepId, TStepMeta>,
  event: JourneyEvent<TStepId, TEventType, TPayloadMap>,
  hooks?: {
    onAsyncGuardStart?: (
      transition: JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>
    ) => void;
    onAsyncGuardSuccess?: (
      transition: JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>
    ) => void;
    onAsyncGuardError?: (
      transition: JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>,
      error: unknown
    ) => void;
  }
): Promise<JourneyTransition<TContext, TStepId, TEventType, TPayloadMap> | null> => {
  for (const transition of transitions) {
    const fromMatches =
      transition.from === JOURNEY_WILDCARD || transition.from === snapshot.currentStepId;
    const eventMatches = transition.event === event.type;

    if (!fromMatches || !eventMatches) {
      continue;
    }

    if (!transition.when) {
      return transition;
    }

    const guardResult = transition.when({
      context: snapshot.context,
      from: snapshot.currentStepId,
      timeline: snapshot.history.timeline,
      index: snapshot.history.index,
      event
    });
    const asyncGuard = isPromiseLike(guardResult);
    if (asyncGuard) {
      hooks?.onAsyncGuardStart?.(transition);
    }

    let allowed: boolean;
    try {
      allowed = await guardResult;
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

export const transitionSnapshot = <TContext, TStepId extends string, TStepMeta>(
  snapshot: JourneySnapshot<TContext, TStepId, TStepMeta>,
  nextCurrent: TStepId,
  nextContext: TContext
): JourneySnapshot<TContext, TStepId, TStepMeta> => {
  const baseTimeline = snapshot.history.timeline.slice(0, snapshot.history.index + 1);
  let nextTimeline = baseTimeline;
  if (nextCurrent !== snapshot.currentStepId) {
    nextTimeline = [...baseTimeline, nextCurrent];
  }

  const nextIndex = nextTimeline.length - 1;
  const visited = appendVisited(snapshot.visited, nextCurrent);

  return buildSnapshot(
    nextTimeline,
    nextIndex,
    nextContext,
    snapshot.status,
    snapshot.async,
    snapshot.stepMeta,
    visited
  );
};
