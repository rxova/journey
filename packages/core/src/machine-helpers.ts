import { JOURNEY_ASYNC_PHASE, JOURNEY_EVENT, JOURNEY_TERMINAL, JOURNEY_WILDCARD } from "./types";
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

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

export const buildVisited = <TStepId extends string>(
  history: readonly TStepId[],
  current: TStepId
): TStepId[] => unique([...history, current]);

export const appendVisited = <TStepId extends string>(
  visited: readonly TStepId[],
  current: TStepId
): TStepId[] => (visited.includes(current) ? [...visited] : [...visited, current]);

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

export const isGoToEvent = <
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
>(
  event: JourneyEvent<TStepId, TEventType, TPayloadMap>
): event is JourneyGoToEvent<
  TStepId,
  JourneyPayloadFor<TEventType, TPayloadMap, (typeof JOURNEY_EVENT)["GO_TO"]>
> => event.type === JOURNEY_EVENT.GO_TO && "to" in event;

export const isTerminalTarget = <TStepId extends string>(
  target: TStepId | JourneyTerminal | "__HISTORY__"
): target is JourneyTerminal =>
  target === JOURNEY_TERMINAL.COMPLETE || target === JOURNEY_TERMINAL.CLOSE;

export const buildSendResult = <TContext, TStepId extends string>(
  snapshot: JourneySnapshot<TContext, TStepId>,
  transitioned: boolean,
  transitionId?: string
): JourneySendResult<TContext, TStepId> =>
  transitionId ? { transitioned, transitionId, snapshot } : { transitioned, snapshot };

export const buildSnapshot = <TContext, TStepId extends string>(
  current: TStepId,
  context: TContext,
  history: readonly TStepId[],
  status: JourneyStatus,
  asyncState: JourneyAsyncState<TStepId>,
  visited?: readonly TStepId[]
): JourneySnapshot<TContext, TStepId> => ({
  status,
  current,
  context,
  history,
  visited: visited ? [...visited] : buildVisited(history, current),
  async: asyncState
});

export const resolveHistoryTarget = <TContext, TStepId extends string>(
  snapshot: JourneySnapshot<TContext, TStepId>,
  steps: Record<TStepId, unknown>
): { target: TStepId; history: TStepId[] } => {
  const cloned = [...snapshot.history];

  while (cloned.length > 0) {
    const candidate = cloned.pop();
    if (!candidate) {
      break;
    }
    if (candidate in steps) {
      return {
        target: candidate,
        history: cloned
      };
    }
  }

  return {
    target: snapshot.current,
    history: [...snapshot.history]
  };
};

export const selectTransition = async <
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
>(
  transitions: readonly JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>[],
  snapshot: JourneySnapshot<TContext, TStepId>,
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
      transition.from === JOURNEY_WILDCARD || transition.from === snapshot.current;
    const eventMatches = transition.event === event.type;

    if (!fromMatches || !eventMatches) {
      continue;
    }

    if (!transition.when) {
      return transition;
    }

    const guardResult = transition.when({
      context: snapshot.context,
      from: snapshot.current,
      history: snapshot.history,
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

export const transitionSnapshot = <TContext, TStepId extends string>(
  snapshot: JourneySnapshot<TContext, TStepId>,
  nextCurrent: TStepId,
  nextContext: TContext
): JourneySnapshot<TContext, TStepId> => {
  const history =
    nextCurrent === snapshot.current
      ? [...snapshot.history]
      : [...snapshot.history, snapshot.current];

  const visited = appendVisited(snapshot.visited, nextCurrent);

  return buildSnapshot(nextCurrent, nextContext, history, snapshot.status, snapshot.async, visited);
};
