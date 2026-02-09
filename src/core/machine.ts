import { FLOW_ASYNC_PHASE, FLOW_EVENT, HISTORY_TARGET } from "./types";
import type {
  FlowAsyncState,
  FlowAsyncPhase,
  FlowEventPayloadMap,
  FlowFlow,
  FlowMachine,
  FlowMachineOptions,
  FlowSendResult
} from "./types";
import {
  assertStepExists,
  buildIdleStepAsyncState,
  buildInitialAsyncState,
  buildSendResult,
  isGoToEvent,
  isPromiseLike,
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
  TEventType extends string = "next" | "back" | "close" | "submit",
  TPayloadMap extends FlowEventPayloadMap<TEventType> = Record<never, never>
>(
  flow: FlowFlow<TContext, TStepId, TEventType, TPayloadMap>,
  options?: FlowMachineOptions<TContext, TStepId>
): FlowMachine<TContext, TStepId, TEventType, TPayloadMap> => {
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
  snapshot = {
    ...snapshot,
    async: buildInitialAsyncState(flow.steps)
  };

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const isAsyncLoadingPhase = (phase: FlowAsyncPhase): boolean =>
    phase === FLOW_ASYNC_PHASE.EVALUATING_WHEN || phase === FLOW_ASYNC_PHASE.RUNNING_EFFECT;

  const updateStepAsync = (
    stepId: TStepId,
    updater: (
      current: FlowAsyncState<TStepId>["byStep"][TStepId]
    ) => FlowAsyncState<TStepId>["byStep"][TStepId]
  ) => {
    const current = snapshot.async.byStep[stepId] ?? buildIdleStepAsyncState();
    const next = updater(current);
    if (
      current.phase === next.phase &&
      current.eventType === next.eventType &&
      current.transitionId === next.transitionId &&
      current.error === next.error
    ) {
      return;
    }
    const nextByStep = {
      ...snapshot.async.byStep,
      [stepId]: next
    };
    const isLoading = Object.values(nextByStep).some((state) => isAsyncLoadingPhase(state.phase));
    snapshot = {
      ...snapshot,
      async: {
        isLoading,
        byStep: nextByStep
      }
    };
    notify();
  };

  const setStepLoading = (
    stepId: TStepId,
    phase: FlowAsyncPhase,
    eventType: string,
    transitionId?: string
  ) => {
    updateStepAsync(stepId, () => ({
      phase,
      eventType,
      transitionId: transitionId ?? null,
      error: null
    }));
  };

  const setStepIdle = (stepId: TStepId) => {
    updateStepAsync(stepId, () => buildIdleStepAsyncState());
  };

  const setStepError = (
    stepId: TStepId,
    eventType: string,
    error: unknown,
    transitionId?: string
  ) => {
    updateStepAsync(stepId, () => ({
      phase: FLOW_ASYNC_PHASE.ERROR,
      eventType,
      transitionId: transitionId ?? null,
      error
    }));
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
      snapshot = buildSnapshot(
        flow.initial,
        flow.context,
        [],
        null,
        buildInitialAsyncState(flow.steps)
      );
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
    clearStepError: (stepId) => {
      const resolvedStep = stepId ?? snapshot.current;
      if (!(resolvedStep in flow.steps)) {
        return snapshot;
      }

      setStepIdle(resolvedStep);
      return snapshot;
    },
    send: (event) => {
      const run = async (): Promise<FlowSendResult<TContext, TStepId>> => {
        if (snapshot.isDone) {
          return { transitioned: false, snapshot };
        }

        const fromStep = snapshot.current;

        if (isGoToEvent(event)) {
          assertStepExists(flow.steps, event.to, `Cannot goTo unknown step "${event.to}".`);
          setStepIdle(fromStep);
          snapshot = transitionSnapshot(snapshot, event.to, snapshot.context);
          persistSnapshot(snapshot);
          notify();
          return buildSendResult(snapshot, true, FLOW_EVENT.GO_TO);
        }

        let transition;
        try {
          transition = await selectTransition(flow.transitions, snapshot, event, {
            onAsyncGuardStart: (currentTransition) => {
              setStepLoading(
                fromStep,
                FLOW_ASYNC_PHASE.EVALUATING_WHEN,
                event.type,
                currentTransition.id
              );
            },
            onAsyncGuardSuccess: () => {
              setStepIdle(fromStep);
            },
            onAsyncGuardError: (currentTransition, error) => {
              setStepError(fromStep, event.type, error, currentTransition.id);
            }
          });
        } catch (error) {
          setStepError(fromStep, event.type, error);
          throw error;
        }

        if (!transition) {
          return buildSendResult(snapshot, false);
        }

        let nextContext = snapshot.context;
        if (transition.effect) {
          const effectResultPromise = transition.effect({
            context: snapshot.context,
            from: snapshot.current,
            history: snapshot.history,
            event
          });
          if (isPromiseLike(effectResultPromise)) {
            setStepLoading(
              fromStep,
              FLOW_ASYNC_PHASE.RUNNING_EFFECT,
              event.type as string,
              transition.id
            );
          }

          let effectResult: TContext | void;
          try {
            effectResult = await effectResultPromise;
          } catch (error) {
            setStepError(fromStep, event.type, error, transition.id);
            throw error;
          }

          if (effectResult !== undefined) {
            nextContext = effectResult;
          }
        }

        setStepIdle(fromStep);

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
          snapshot = buildSnapshot(target, nextContext, history, snapshot.terminal, snapshot.async);
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
