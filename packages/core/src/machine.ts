import {
  JOURNEY_ASYNC_PHASE,
  JOURNEY_EVENT,
  JOURNEY_STATUS,
  JOURNEY_TERMINAL,
  JOURNEY_WILDCARD,
  HISTORY_TARGET
} from "./types";
import type {
  JourneyAsyncState,
  JourneyAsyncPhase,
  JourneyEventPayloadMap,
  JourneyDefinition,
  JourneyMachine,
  JourneyMachineOptions,
  JourneySendResult
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

/**
 * Creates a journey machine from a journey definition.
 * Validates steps/transitions, hydrates persisted state (if configured),
 * and returns an API for sending events and reading snapshots.
 */
export const createJourneyMachine = <
  TContext,
  TStepId extends string,
  TEventType extends string = "next" | "back" | "close" | "submit",
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
>(
  journey: JourneyDefinition<TContext, TStepId, TEventType, TPayloadMap>,
  options?: JourneyMachineOptions<TContext, TStepId>
): JourneyMachine<TContext, TStepId, TEventType, TPayloadMap> => {
  if (!journey.steps || typeof journey.steps !== "object") {
    throw new Error("Journey steps must be a record object.");
  }

  if (!Array.isArray(journey.transitions)) {
    throw new Error("Journey transitions must be an array.");
  }

  assertStepExists(
    journey.steps,
    journey.initial,
    `Journey initial step "${journey.initial}" does not exist in steps registry.`
  );

  for (const [index, transition] of journey.transitions.entries()) {
    if (!transition || typeof transition !== "object") {
      throw new Error(`Journey transition at index ${index} must be an object.`);
    }

    if (typeof transition.from !== "string" || typeof transition.event !== "string") {
      throw new Error(
        `Journey transition at index ${index} must define string "from" and "event".`
      );
    }

    if (
      transition.from !== JOURNEY_WILDCARD &&
      !((transition.from as string) in (journey.steps as Record<string, unknown>))
    ) {
      throw new Error(
        `Journey transition at index ${index} references unknown from step "${transition.from}".`
      );
    }

    if (
      transition.to !== HISTORY_TARGET &&
      !isTerminalTarget(transition.to) &&
      !((transition.to as string) in (journey.steps as Record<string, unknown>))
    ) {
      throw new Error(
        `Journey transition at index ${index} points to unknown step "${transition.to}".`
      );
    }
  }

  const { clearOnReset, hydrateSnapshot, persistSnapshot, removePersistedSnapshot } =
    createPersistenceController({
      initial: journey.initial,
      context: journey.context,
      steps: journey.steps,
      ...(options ? { options } : {})
    });

  let snapshot = hydrateSnapshot();
  const listeners = new Set<() => void>();
  let sendQueue: Promise<void> = Promise.resolve();
  snapshot = {
    ...snapshot,
    async: buildInitialAsyncState(journey.steps)
  };

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const isAsyncLoadingPhase = (phase: JourneyAsyncPhase): boolean =>
    phase === JOURNEY_ASYNC_PHASE.EVALUATING_WHEN || phase === JOURNEY_ASYNC_PHASE.RUNNING_EFFECT;

  const updateStepAsync = (
    stepId: TStepId,
    updater: (
      current: JourneyAsyncState<TStepId>["byStep"][TStepId]
    ) => JourneyAsyncState<TStepId>["byStep"][TStepId]
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
    phase: JourneyAsyncPhase,
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
      phase: JOURNEY_ASYNC_PHASE.ERROR,
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
        journey.initial,
        journey.context,
        [],
        JOURNEY_STATUS.RUNNING,
        buildInitialAsyncState(journey.steps)
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
      if (!(resolvedStep in journey.steps)) {
        return snapshot;
      }

      setStepIdle(resolvedStep);
      return snapshot;
    },
    send: (event) => {
      const run = async (): Promise<JourneySendResult<TContext, TStepId>> => {
        if (snapshot.status !== JOURNEY_STATUS.RUNNING) {
          return { transitioned: false, snapshot };
        }

        const fromStep = snapshot.current;

        if (isGoToEvent(event)) {
          assertStepExists(journey.steps, event.to, `Cannot goTo unknown step "${event.to}".`);
          setStepIdle(fromStep);
          snapshot = transitionSnapshot(snapshot, event.to, snapshot.context);
          persistSnapshot(snapshot);
          notify();
          return buildSendResult(snapshot, true, JOURNEY_EVENT.GO_TO);
        }

        let transition;
        try {
          transition = await selectTransition(journey.transitions, snapshot, event, {
            onAsyncGuardStart: (currentTransition) => {
              setStepLoading(
                fromStep,
                JOURNEY_ASYNC_PHASE.EVALUATING_WHEN,
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
              JOURNEY_ASYNC_PHASE.RUNNING_EFFECT,
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
            status:
              transition.to === JOURNEY_TERMINAL.COMPLETE
                ? JOURNEY_STATUS.COMPLETE
                : JOURNEY_STATUS.CLOSED
          };
          persistSnapshot(snapshot);
          notify();
          return buildSendResult(snapshot, true, transition.id);
        }

        if (transition.to === HISTORY_TARGET) {
          const { target, history } = resolveHistoryTarget(snapshot, journey.steps);
          assertStepExists(journey.steps, target, `Transition points to unknown step "${target}".`);
          snapshot = buildSnapshot(target, nextContext, history, snapshot.status, snapshot.async);
          persistSnapshot(snapshot);
          notify();
          return buildSendResult(snapshot, true, transition.id);
        }

        const resolvedTarget = transition.to;

        assertStepExists(
          journey.steps,
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
