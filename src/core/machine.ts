import { HISTORY_TARGET } from "./types";
import type {
  FlowFlow,
  FlowMachine,
  FlowMachineOptions,
  FlowSendResult
} from "./types";
import {
  assertStepExists,
  buildSendResult,
  isGoToEvent,
  isTerminalTarget,
  resolveHistoryTarget,
  selectTransition,
  transitionSnapshot,
  buildSnapshot
} from "./machine-helpers";
import { createPersistenceController } from "./persistence";

export const createFlowMachine = <
  TContext,
  TStepId extends string,
  TEventType extends string = "next" | "back" | "close" | "submit"
>(
  flow: FlowFlow<TContext, TStepId, TEventType>,
  options?: FlowMachineOptions<TContext, TStepId>
): FlowMachine<TContext, TStepId, TEventType> => {
  assertStepExists(
    flow.steps,
    flow.initial,
    `Flow initial step "${flow.initial}" does not exist in steps registry.`
  );

  const { clearOnReset, hydrateSnapshot, persistSnapshot, removePersistedSnapshot } =
    createPersistenceController({
      initial: flow.initial,
      context: flow.context,
      steps: flow.steps,
      ...(options ? { options } : {})
    });

  let snapshot = hydrateSnapshot();
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
      if (clearOnReset) {
        removePersistedSnapshot();
      } else {
        persistSnapshot(snapshot);
      }
      notify();
      return snapshot;
    },
    updateContext: (updater) => {
      snapshot = {
        ...snapshot,
        context: updater(snapshot.context)
      };
      persistSnapshot(snapshot);
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
          persistSnapshot(snapshot);
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
          persistSnapshot(snapshot);
          notify();
          return buildSendResult(snapshot, true, transition.id);
        }

        if (transition.to === HISTORY_TARGET) {
          const { target, history } = resolveHistoryTarget(snapshot, flow.steps);
          assertStepExists(flow.steps, target, `Transition points to unknown step "${target}".`);
          snapshot = buildSnapshot(target, nextContext, history, snapshot.terminal);
          persistSnapshot(snapshot);
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
        persistSnapshot(snapshot);
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
