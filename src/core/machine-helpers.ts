import { FLOW_EVENT, FLOW_TERMINAL, FLOW_WILDCARD } from "./types";
import type {
  FlowEvent,
  FlowEventPayloadMap,
  FlowGoToEvent,
  FlowPayloadFor,
  FlowSendResult,
  FlowSnapshot,
  FlowTerminal,
  FlowTransition
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

export const isGoToEvent = <
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends FlowEventPayloadMap<TEventType>
>(
  event: FlowEvent<TStepId, TEventType, TPayloadMap>
): event is FlowGoToEvent<
  TStepId,
  FlowPayloadFor<TEventType, TPayloadMap, (typeof FLOW_EVENT)["GO_TO"]>
> => event.type === FLOW_EVENT.GO_TO && "to" in event;

export const isTerminalTarget = <TStepId extends string>(
  target: TStepId | FlowTerminal | "__HISTORY__"
): target is FlowTerminal => target === FLOW_TERMINAL.COMPLETE || target === FLOW_TERMINAL.CLOSE;

export const buildSendResult = <TContext, TStepId extends string>(
  snapshot: FlowSnapshot<TContext, TStepId>,
  transitioned: boolean,
  transitionId?: string
): FlowSendResult<TContext, TStepId> =>
  transitionId ? { transitioned, transitionId, snapshot } : { transitioned, snapshot };

export const buildSnapshot = <TContext, TStepId extends string>(
  current: TStepId,
  context: TContext,
  history: readonly TStepId[],
  terminal: (typeof FLOW_TERMINAL)[keyof typeof FLOW_TERMINAL] | null
): FlowSnapshot<TContext, TStepId> => ({
  current,
  context,
  history,
  terminal,
  isDone: terminal !== null,
  visited: unique([...history, current])
});

export const resolveHistoryTarget = <TContext, TStepId extends string>(
  snapshot: FlowSnapshot<TContext, TStepId>,
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
  TPayloadMap extends FlowEventPayloadMap<TEventType>
>(
  transitions: readonly FlowTransition<TContext, TStepId, TEventType, TPayloadMap>[],
  snapshot: FlowSnapshot<TContext, TStepId>,
  event: FlowEvent<TStepId, TEventType, TPayloadMap>
): Promise<FlowTransition<TContext, TStepId, TEventType, TPayloadMap> | null> => {
  for (const transition of transitions) {
    const fromMatches = transition.from === FLOW_WILDCARD || transition.from === snapshot.current;
    const eventMatches = transition.event === event.type;

    if (!fromMatches || !eventMatches) {
      continue;
    }

    if (!transition.when) {
      return transition;
    }

    const allowed = await transition.when({
      context: snapshot.context,
      from: snapshot.current,
      history: snapshot.history,
      event
    });

    if (allowed) {
      return transition;
    }
  }

  return null;
};

export const transitionSnapshot = <TContext, TStepId extends string>(
  snapshot: FlowSnapshot<TContext, TStepId>,
  nextCurrent: TStepId,
  nextContext: TContext
): FlowSnapshot<TContext, TStepId> => {
  const history =
    nextCurrent === snapshot.current
      ? [...snapshot.history]
      : [...snapshot.history, snapshot.current];

  return buildSnapshot(nextCurrent, nextContext, history, snapshot.terminal);
};
