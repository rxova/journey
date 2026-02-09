import { HISTORY_TARGET, FLOW_TERMINAL } from "./types";
import type {
  FlowEvent,
  FlowFlow,
  FlowGoToEvent,
  FlowMachine,
  FlowSendResult,
  FlowSnapshot,
  FlowTerminal,
  FlowTransition
} from "./types";

const assertStepExists = <TStepId extends string>(
  steps: Record<TStepId, unknown>,
  stepId: TStepId,
  message: string
) => {
  if (!(stepId in steps)) {
    throw new Error(message);
  }
};

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

const isGoToEvent = <TStepId extends string, TEventType extends string>(
  event: FlowEvent<TStepId, TEventType>
): event is FlowGoToEvent<TStepId> => event.type === "goTo" && "to" in event;

const isTerminalTarget = <TStepId extends string>(
  target: TStepId | FlowTerminal | typeof HISTORY_TARGET
): target is FlowTerminal =>
  target === FLOW_TERMINAL.COMPLETE || target === FLOW_TERMINAL.CLOSE;

const buildSendResult = <TContext, TStepId extends string>(
  snapshot: FlowSnapshot<TContext, TStepId>,
  transitioned: boolean,
  transitionId?: string
): FlowSendResult<TContext, TStepId> =>
  transitionId ? { transitioned, transitionId, snapshot } : { transitioned, snapshot };

const buildSnapshot = <TContext, TStepId extends string>(
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

const resolveHistoryTarget = <TContext, TStepId extends string>(
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

const selectTransition = async <TContext, TStepId extends string, TEventType extends string>(
  transitions: readonly FlowTransition<TContext, TStepId, TEventType>[],
  snapshot: FlowSnapshot<TContext, TStepId>,
  event: FlowEvent<TStepId, TEventType>
): Promise<FlowTransition<TContext, TStepId, TEventType> | null> => {
  for (const transition of transitions) {
    const fromMatches = transition.from === "*" || transition.from === snapshot.current;
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

const transitionSnapshot = <TContext, TStepId extends string>(
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

export const createFlowMachine = <
  TContext,
  TStepId extends string,
  TEventType extends string = "next" | "back" | "close" | "submit"
>(
  flow: FlowFlow<TContext, TStepId, TEventType>
): FlowMachine<TContext, TStepId, TEventType> => {
  assertStepExists(
    flow.steps,
    flow.initial,
    `Flow initial step "${flow.initial}" does not exist in steps registry.`
  );

  let snapshot = buildSnapshot(flow.initial, flow.context, [], null);
  const listeners = new Set<() => void>();
  let sendQueue: Promise<void> = Promise.resolve();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reset: () => {
      snapshot = buildSnapshot(flow.initial, flow.context, [], null);
      notify();
      return snapshot;
    },
    updateContext: (updater) => {
      snapshot = {
        ...snapshot,
        context: updater(snapshot.context)
      };
      notify();
      return snapshot;
    },
    send: (event) => {
      const run = async (): Promise<FlowSendResult<TContext, TStepId>> => {
        if (snapshot.isDone) {
          return { transitioned: false, snapshot };
        }

        if (isGoToEvent(event)) {
          assertStepExists(flow.steps, event.to, `Cannot goTo unknown step "${event.to}".`);
          snapshot = transitionSnapshot(snapshot, event.to, snapshot.context);
          notify();
          return buildSendResult(snapshot, true, "goTo");
        }

        const transition = await selectTransition(flow.transitions, snapshot, event);

        if (!transition) {
          return buildSendResult(snapshot, false);
        }

        let nextContext = snapshot.context;
        if (transition.effect) {
          const effectResult = await transition.effect({
            context: snapshot.context,
            from: snapshot.current,
            history: snapshot.history,
            event
          });

          if (effectResult !== undefined) {
            nextContext = effectResult;
          }
        }

        if (isTerminalTarget(transition.to)) {
          snapshot = {
            ...snapshot,
            context: nextContext,
            terminal: transition.to,
            isDone: true
          };
          notify();
          return buildSendResult(snapshot, true, transition.id);
        }

        if (transition.to === HISTORY_TARGET) {
          const { target, history } = resolveHistoryTarget(snapshot, flow.steps);
          assertStepExists(flow.steps, target, `Transition points to unknown step "${target}".`);
          snapshot = buildSnapshot(target, nextContext, history, snapshot.terminal);
          notify();
          return buildSendResult(snapshot, true, transition.id);
        }

        const resolvedTarget = transition.to;

        assertStepExists(
          flow.steps,
          resolvedTarget,
          `Transition points to unknown step "${resolvedTarget}".`
        );

        const nextSnapshot = transitionSnapshot(snapshot, resolvedTarget, nextContext);

        snapshot = nextSnapshot;
        notify();

        return buildSendResult(snapshot, true, transition.id);
      };

      const resultPromise = sendQueue.then(run, run);
      sendQueue = resultPromise.then(
        () => undefined,
        () => undefined
      );
      return resultPromise;
    }
  };
};
