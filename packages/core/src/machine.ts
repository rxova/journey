import { JOURNEY_ASYNC_PHASE, JOURNEY_EVENT, JOURNEY_STATUS } from "./types";
import { createTypedTransitionHelpers } from "./transitions";
import type {
  JourneyEqualityFn,
  JourneyAsyncState,
  JourneyAsyncPhase,
  JourneyDefaultEventType,
  JourneyDefinition,
  JourneyEvent,
  JourneyEventPayloadMap,
  JourneyMachine,
  JourneyMachineOptions,
  JourneyObservationEvent,
  JourneyResolvedDefinition,
  JourneySelector,
  JourneySendEvent,
  JourneySendResult,
  JourneyStepDefinition,
  JourneyTransition,
  JourneyTransitionArgs,
  JourneyTerminal
} from "./types";
import {
  assertStepExists,
  buildIdleStepAsyncState,
  buildInitialAsyncState,
  buildSendResult,
  buildSnapshot,
  isGoToStepByIdEvent,
  isPromiseLike,
  isTerminalTarget,
  JourneyTimeoutError,
  withTimeout,
  normalizeStepCount,
  now,
  selectTransition,
  transitionSnapshot,
  validateJourneyTransitions
} from "./machine-helpers";
import { createPersistenceController } from "./persistence";

const resolveJourneyTransitions = <
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>,
  TStepMeta = unknown,
  TStepExtra extends object = Record<never, never>
>(
  journey: JourneyDefinition<TContext, TStepId, TEventType, TPayloadMap, TStepMeta, TStepExtra>
): JourneyResolvedDefinition<
  TContext,
  TStepId,
  TEventType,
  TPayloadMap,
  TStepMeta,
  TStepExtra
> => ({
  ...journey,
  transitions:
    typeof journey.transitions === "function"
      ? journey.transitions(
          createTypedTransitionHelpers<TContext, TStepId, TEventType, TPayloadMap>()
        )
      : journey.transitions
});

/**
 * Creates a journey machine from a journey definition.
 * Validates steps/transitions, hydrates persisted state (if configured),
 * and returns an API for sending events and reading snapshots.
 */
export function createJourneyMachine<
  TContext,
  TStepMeta = unknown,
  TSteps extends Record<string, JourneyStepDefinition<TStepMeta>> = Record<
    string,
    JourneyStepDefinition<TStepMeta>
  >,
  TPayloadMap extends JourneyEventPayloadMap<JourneyDefaultEventType> = Record<never, never>
>(
  journey: JourneyDefinition<
    TContext,
    Extract<keyof TSteps, string>,
    JourneyDefaultEventType,
    TPayloadMap,
    TStepMeta
  > & {
    steps: TSteps;
  },
  options?: JourneyMachineOptions<TContext, Extract<keyof TSteps, string>, TStepMeta>
): JourneyMachine<
  TContext,
  Extract<keyof TSteps, string>,
  JourneyDefaultEventType,
  TPayloadMap,
  TStepMeta
>;
// eslint-disable-next-line no-redeclare
export function createJourneyMachine<
  TContext,
  TStepId extends string,
  TEventType extends string = JourneyDefaultEventType,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>,
  TStepMeta = unknown
>(
  journey: JourneyDefinition<TContext, TStepId, TEventType, TPayloadMap, TStepMeta>,
  options?: JourneyMachineOptions<TContext, TStepId, TStepMeta>
): JourneyMachine<TContext, TStepId, TEventType, TPayloadMap, TStepMeta>;
// eslint-disable-next-line no-redeclare
export function createJourneyMachine<
  TContext,
  TStepId extends string,
  TEventType extends string = JourneyDefaultEventType,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>,
  TStepMeta = unknown
>(
  journey: JourneyDefinition<TContext, TStepId, TEventType, TPayloadMap, TStepMeta>,
  options?: JourneyMachineOptions<TContext, TStepId, TStepMeta>
): JourneyMachine<TContext, TStepId, TEventType, TPayloadMap, TStepMeta> {
  if (!journey.steps || typeof journey.steps !== "object") {
    throw new Error("Journey steps must be a record object.");
  }

  if (typeof journey.transitions !== "function" && !Array.isArray(journey.transitions)) {
    throw new Error("Journey transitions must be an array or a factory function.");
  }

  for (const stepId of Object.keys(journey.steps)) {
    if (stepId === "*") {
      throw new Error('Step id "*" is reserved as a wildcard and cannot be used as a step name.');
    }
  }

  assertStepExists(
    journey.steps,
    journey.initial,
    `Journey initial step "${journey.initial}" does not exist in steps registry.`
  );

  const resolvedJourney = resolveJourneyTransitions(journey);
  validateJourneyTransitions(resolvedJourney.transitions, resolvedJourney.steps);

  const buildStepMeta = (): Record<TStepId, TStepMeta> => {
    const stepMeta = {} as Record<TStepId, TStepMeta>;
    for (const stepId of Object.keys(resolvedJourney.steps) as TStepId[]) {
      stepMeta[stepId] = resolvedJourney.steps[stepId].meta as TStepMeta;
    }
    return stepMeta;
  };

  const { clearOnReset, hydrateSnapshot, persistSnapshot, removePersistedSnapshot } =
    createPersistenceController({
      initial: resolvedJourney.initial,
      context: resolvedJourney.context,
      stepMeta: buildStepMeta(),
      steps: resolvedJourney.steps,
      ...(options ? { options } : {})
    });

  let snapshot = hydrateSnapshot();
  snapshot = {
    ...snapshot,
    async: buildInitialAsyncState(resolvedJourney.steps)
  };
  const completeOnNoNextStep = options?.completeOnNoNextStep ?? true;
  const startupEvent: JourneyObservationEvent<TStepId, TEventType, TPayloadMap, TStepMeta> = {
    type: "journey.start",
    stepId: snapshot.currentStepId,
    timestamp: now()
  };

  const listeners = new Set<() => void>();
  const eventListeners = new Set<
    (event: JourneyObservationEvent<TStepId, TEventType, TPayloadMap, TStepMeta>) => void
  >();
  let actionQueue: Promise<void> = Promise.resolve();
  let lifecycleVersion = 0;
  let isDisposed = false;

  const isRunActive = (runVersion: number): boolean =>
    !isDisposed && runVersion === lifecycleVersion;

  const cancelInFlight = () => {
    lifecycleVersion += 1;
    actionQueue = Promise.resolve();
  };

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const emit = (event: JourneyObservationEvent<TStepId, TEventType, TPayloadMap, TStepMeta>) => {
    for (const listener of eventListeners) {
      listener(event);
    }
  };

  const queue = <T>(
    runner: (runVersion: number) => Promise<T>,
    onCanceled: () => T
  ): Promise<T> => {
    const runVersion = lifecycleVersion;
    const createQueuedRunner = async () => {
      if (!isRunActive(runVersion)) {
        return onCanceled();
      }
      return runner(runVersion);
    };

    const settleQueue = (resultPromise: Promise<T>) => {
      actionQueue = resultPromise.then(
        () => undefined,
        () => undefined
      );
    };

    const resultPromise = actionQueue.then(createQueuedRunner, createQueuedRunner);
    settleQueue(resultPromise);
    return resultPromise;
  };

  const isAsyncLoadingPhase = (phase: JourneyAsyncPhase): boolean =>
    phase === JOURNEY_ASYNC_PHASE.EVALUATING_WHEN || phase === JOURNEY_ASYNC_PHASE.RUNNING_EFFECT;

  const updateStepAsync = (
    stepId: TStepId,
    updater: (
      current: JourneyAsyncState<TStepId>["byStep"][TStepId]
    ) => JourneyAsyncState<TStepId>["byStep"][TStepId],
    runVersion?: number
  ) => {
    if (runVersion !== undefined && !isRunActive(runVersion)) {
      return;
    }

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
    transitionId?: string,
    runVersion?: number
  ) => {
    updateStepAsync(
      stepId,
      () => ({
        phase,
        eventType,
        transitionId: transitionId ?? null,
        error: null
      }),
      runVersion
    );
  };

  const setStepIdle = (stepId: TStepId, runVersion?: number) => {
    updateStepAsync(stepId, () => buildIdleStepAsyncState(), runVersion);
  };

  const setStepError = (
    stepId: TStepId,
    eventType: string,
    error: unknown,
    transitionId?: string,
    runVersion?: number
  ) => {
    updateStepAsync(
      stepId,
      () => ({
        phase: JOURNEY_ASYNC_PHASE.ERROR,
        eventType,
        transitionId: transitionId ?? null,
        error
      }),
      runVersion
    );
  };

  const applyPreviousNavigation = (
    requestedSteps?: number,
    transitionId?: string
  ): JourneySendResult<TContext, TStepId, TStepMeta> => {
    if (snapshot.status !== JOURNEY_STATUS.RUNNING) {
      return buildSendResult(snapshot, false);
    }

    const steps = normalizeStepCount(requestedSteps);
    if (snapshot.history.index === 0) {
      return buildSendResult(snapshot, false);
    }

    const from = snapshot.currentStepId;
    const nextIndex = Math.max(0, snapshot.history.index - steps);
    const appliedSteps = snapshot.history.index - nextIndex;
    if (appliedSteps <= 0) {
      return buildSendResult(snapshot, false);
    }

    emit({ type: "step.exit", stepId: from, timestamp: now() });
    snapshot = buildSnapshot(
      snapshot.history.timeline,
      nextIndex,
      snapshot.context,
      snapshot.status,
      snapshot.async,
      snapshot.stepMeta,
      snapshot.visited
    );
    persistSnapshot(snapshot);
    notify();

    emit({
      type: "navigation.previous",
      from,
      to: snapshot.currentStepId,
      requestedSteps: steps,
      appliedSteps,
      timestamp: now()
    });
    emit({ type: "step.enter", stepId: snapshot.currentStepId, timestamp: now() });
    return buildSendResult(snapshot, true, {
      ...(transitionId !== undefined ? { transitionId } : {})
    });
  };

  const applyLastVisitedNavigation = (
    transitionId?: string
  ): JourneySendResult<TContext, TStepId, TStepMeta> => {
    if (snapshot.status !== JOURNEY_STATUS.RUNNING) {
      return buildSendResult(snapshot, false);
    }

    const targetIndex = snapshot.history.timeline.length - 1;
    if (snapshot.history.index >= targetIndex) {
      return buildSendResult(snapshot, false);
    }

    const from = snapshot.currentStepId;
    emit({ type: "step.exit", stepId: from, timestamp: now() });
    snapshot = buildSnapshot(
      snapshot.history.timeline,
      targetIndex,
      snapshot.context,
      snapshot.status,
      snapshot.async,
      snapshot.stepMeta,
      snapshot.visited
    );
    persistSnapshot(snapshot);
    notify();

    emit({ type: "navigation.lastVisited", from, to: snapshot.currentStepId, timestamp: now() });
    emit({ type: "step.enter", stepId: snapshot.currentStepId, timestamp: now() });
    return buildSendResult(snapshot, true, {
      ...(transitionId !== undefined ? { transitionId } : {})
    });
  };

  type RuntimeSendEvent = JourneySendEvent<TStepId, TEventType, TPayloadMap>;
  type RuntimeTransitionEvent = JourneyEvent<TStepId, TEventType, TPayloadMap>;
  type RuntimeTransition = JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>;

  const buildCanceledSendResult = (): JourneySendResult<TContext, TStepId, TStepMeta> =>
    buildSendResult(snapshot, false);

  const buildErroredSendResult = (
    error: unknown,
    transitionId?: string
  ): JourneySendResult<TContext, TStepId, TStepMeta> =>
    buildSendResult(snapshot, false, {
      ...(transitionId !== undefined ? { transitionId } : {}),
      error
    });

  const buildTransitionErrorResult = (
    fromStep: TStepId,
    eventType: string,
    error: unknown,
    transitionId: string | null,
    runVersion: number
  ): JourneySendResult<TContext, TStepId, TStepMeta> => {
    setStepError(fromStep, eventType, error, transitionId ?? undefined, runVersion);
    emit({
      type: "transition.error",
      from: fromStep,
      eventType,
      transitionId,
      error,
      timestamp: now()
    });
    return buildErroredSendResult(error, transitionId ?? undefined);
  };

  const applyDirectGoToStepById = (
    stepId: TStepId,
    fromStep: TStepId,
    runVersion: number
  ): JourneySendResult<TContext, TStepId, TStepMeta> => {
    setStepIdle(fromStep, runVersion);

    const beforeCurrent = snapshot.currentStepId;
    const nextSnapshot = transitionSnapshot(snapshot, stepId, snapshot.context);
    if (nextSnapshot.currentStepId !== beforeCurrent) {
      emit({ type: "step.exit", stepId: beforeCurrent, timestamp: now() });
    }

    snapshot = nextSnapshot;
    persistSnapshot(snapshot);
    notify();

    emit({
      type: "transition.success",
      from: fromStep,
      to: snapshot.currentStepId,
      eventType: JOURNEY_EVENT.GO_TO_STEP_BY_ID,
      transitionId: JOURNEY_EVENT.GO_TO_STEP_BY_ID,
      timestamp: now()
    });

    if (nextSnapshot.currentStepId !== beforeCurrent) {
      emit({ type: "step.enter", stepId: snapshot.currentStepId, timestamp: now() });
    }

    return buildSendResult(snapshot, true, { transitionId: JOURNEY_EVENT.GO_TO_STEP_BY_ID });
  };

  const resolveTransitionsForSend = (
    event: RuntimeSendEvent,
    fromStep: TStepId,
    runVersion: number
  ): {
    transitionsToEvaluate: readonly RuntimeTransition[];
    earlyResult: JourneySendResult<TContext, TStepId, TStepMeta> | null;
  } => {
    if (!isGoToStepByIdEvent(event)) {
      return { transitionsToEvaluate: resolvedJourney.transitions, earlyResult: null };
    }

    assertStepExists(
      resolvedJourney.steps,
      event.stepId,
      `Cannot goToStepById unknown step "${event.stepId}".`
    );

    const goToStepTransitions = resolvedJourney.transitions.filter((transition) => {
      const fromMatches = transition.from === "*" || transition.from === fromStep;
      return (
        fromMatches &&
        transition.event === JOURNEY_EVENT.GO_TO_STEP_BY_ID &&
        "to" in transition &&
        transition.to === event.stepId
      );
    });

    if (goToStepTransitions.length === 0) {
      return {
        transitionsToEvaluate: resolvedJourney.transitions,
        earlyResult: applyDirectGoToStepById(event.stepId, fromStep, runVersion)
      };
    }

    return { transitionsToEvaluate: goToStepTransitions, earlyResult: null };
  };

  const selectTransitionForSend = async (
    transitionsToEvaluate: readonly RuntimeTransition[],
    transitionEvent: RuntimeTransitionEvent,
    fromStep: TStepId,
    runVersion: number
  ): Promise<
    | { transition: RuntimeTransition | null; earlyResult: null }
    | { transition: null; earlyResult: JourneySendResult<TContext, TStepId, TStepMeta> }
  > => {
    let transition;
    try {
      transition = await selectTransition(transitionsToEvaluate, snapshot, transitionEvent, {
        onAsyncGuardStart: (currentTransition) => {
          setStepLoading(
            fromStep,
            JOURNEY_ASYNC_PHASE.EVALUATING_WHEN,
            transitionEvent.type,
            currentTransition.id,
            runVersion
          );
        },
        onAsyncGuardSuccess: () => {
          setStepIdle(fromStep, runVersion);
        },
        onAsyncGuardError: (currentTransition, error) => {
          setStepError(fromStep, transitionEvent.type, error, currentTransition.id, runVersion);
        }
      });
    } catch (error) {
      if (!isRunActive(runVersion)) {
        return { transition: null, earlyResult: buildCanceledSendResult() };
      }

      return {
        transition: null,
        earlyResult: buildTransitionErrorResult(
          fromStep,
          transitionEvent.type,
          error,
          null,
          runVersion
        )
      };
    }

    return { transition, earlyResult: null };
  };

  const handleNoTransitionMatch = (
    event: RuntimeSendEvent,
    fromStep: TStepId
  ): JourneySendResult<TContext, TStepId, TStepMeta> => {
    if (isGoToStepByIdEvent(event)) {
      return buildCanceledSendResult();
    }

    if (event.type === "goToPreviousStep" || event.type === "back") {
      const fallbackResult = applyPreviousNavigation(1, event.type);
      if (fallbackResult.transitioned) {
        emit({
          type: "transition.success",
          from: fromStep,
          to: fallbackResult.snapshot.currentStepId,
          eventType: event.type,
          transitionId: null,
          timestamp: now()
        });
      }
      return fallbackResult;
    }

    if (
      event.type === "goToNextStep" &&
      completeOnNoNextStep &&
      !hasDeclaredTransitionForEvent(fromStep, "goToNextStep")
    ) {
      return commitTerminalTransition(fromStep, "COMPLETE", event, null, snapshot.context);
    }

    return buildCanceledSendResult();
  };

  const resolveNextContext = async (
    transition: RuntimeTransition,
    transitionEvent: RuntimeTransitionEvent,
    fromStep: TStepId,
    runVersion: number
  ): Promise<
    | { nextContext: TContext; earlyResult: null }
    | { nextContext: null; earlyResult: JourneySendResult<TContext, TStepId, TStepMeta> }
  > => {
    let nextContext = snapshot.context;
    if (!transition.effect) {
      return { nextContext, earlyResult: null };
    }

    let effectResultPromise: TContext | void | Promise<TContext | void>;
    try {
      effectResultPromise = (
        transition.effect as (
          args: JourneyTransitionArgs<TContext, TStepId, TEventType, TPayloadMap>
        ) => TContext | void | Promise<TContext | void>
      )({
        context: snapshot.context,
        from: snapshot.currentStepId,
        timeline: snapshot.history.timeline,
        index: snapshot.history.index,
        event: transitionEvent
      });
    } catch (error) {
      if (!isRunActive(runVersion)) {
        return { nextContext: null, earlyResult: buildCanceledSendResult() };
      }

      return {
        nextContext: null,
        earlyResult: buildTransitionErrorResult(
          fromStep,
          transitionEvent.type,
          error,
          transition.id ?? null,
          runVersion
        )
      };
    }

    const asyncEffect = isPromiseLike(effectResultPromise);
    if (asyncEffect) {
      setStepLoading(
        fromStep,
        JOURNEY_ASYNC_PHASE.RUNNING_EFFECT,
        transitionEvent.type,
        transition.id,
        runVersion
      );

      const timeoutMs = transition.timeoutMs;
      effectResultPromise = withTimeout(
        effectResultPromise as PromiseLike<TContext | void>,
        timeoutMs,
        () =>
          new JourneyTimeoutError(
            `Transition effect timed out after ${timeoutMs}ms (event: ${transitionEvent.type}, transition: ${transition.id ?? "<anonymous>"}).`
          )
      );
    }

    let effectResult: TContext | void;
    try {
      effectResult = await effectResultPromise;
    } catch (error) {
      if (!isRunActive(runVersion)) {
        return { nextContext: null, earlyResult: buildCanceledSendResult() };
      }

      return {
        nextContext: null,
        earlyResult: buildTransitionErrorResult(
          fromStep,
          transitionEvent.type,
          error,
          transition.id ?? null,
          runVersion
        )
      };
    }

    if (!isRunActive(runVersion)) {
      return { nextContext: null, earlyResult: buildCanceledSendResult() };
    }

    if (effectResult !== undefined) {
      nextContext = effectResult;
    }

    return { nextContext, earlyResult: null };
  };

  const resolveTransitionTarget = (transition: RuntimeTransition): TStepId | JourneyTerminal =>
    transition.event === "completeJourney"
      ? "COMPLETE"
      : transition.event === "terminateJourney"
        ? "TERMINATED"
        : (transition.to as TStepId | JourneyTerminal);

  const hasDeclaredTransitionForEvent = (fromStep: TStepId, eventType: string): boolean =>
    resolvedJourney.transitions.some((transition) => {
      const fromMatches = transition.from === "*" || transition.from === fromStep;
      return fromMatches && transition.event === eventType;
    });

  const commitTerminalTransition = (
    fromStep: TStepId,
    target: JourneyTerminal,
    transitionEvent: RuntimeSendEvent,
    transitionId: string | null,
    nextContext: TContext
  ): JourneySendResult<TContext, TStepId, TStepMeta> => {
    const normalizedTimeline = snapshot.history.timeline.slice(0, snapshot.history.index + 1);
    snapshot = {
      ...snapshot,
      history: {
        timeline: normalizedTimeline,
        index: normalizedTimeline.length - 1
      },
      context: nextContext,
      status: target === "COMPLETE" ? JOURNEY_STATUS.COMPLETE : JOURNEY_STATUS.TERMINATED
    };
    persistSnapshot(snapshot);
    notify();

    emit({
      type: "transition.success",
      from: fromStep,
      to: target,
      eventType: transitionEvent.type,
      transitionId,
      timestamp: now()
    });
    emit({
      type: target === "COMPLETE" ? "journey.complete" : "journey.close",
      stepId: snapshot.currentStepId,
      timestamp: now()
    });

    return buildSendResult(snapshot, true, {
      ...(transitionId !== null ? { transitionId } : {})
    });
  };

  const commitStepTransition = (
    fromStep: TStepId,
    target: TStepId,
    transitionEvent: RuntimeTransitionEvent,
    transition: RuntimeTransition,
    nextContext: TContext
  ): JourneySendResult<TContext, TStepId, TStepMeta> => {
    assertStepExists(
      resolvedJourney.steps,
      target,
      `Transition points to unknown step "${target}".`
    );

    const beforeCurrent = snapshot.currentStepId;
    if (beforeCurrent !== target) {
      emit({ type: "step.exit", stepId: beforeCurrent, timestamp: now() });
    }
    snapshot = transitionSnapshot(snapshot, target, nextContext);
    persistSnapshot(snapshot);
    notify();

    emit({
      type: "transition.success",
      from: fromStep,
      to: snapshot.currentStepId,
      eventType: transitionEvent.type,
      transitionId: transition.id ?? null,
      timestamp: now()
    });
    if (beforeCurrent !== snapshot.currentStepId) {
      emit({ type: "step.enter", stepId: snapshot.currentStepId, timestamp: now() });
    }

    return buildSendResult(snapshot, true, {
      ...(transition.id !== undefined ? { transitionId: transition.id } : {})
    });
  };

  const executeSend = async (
    event: RuntimeSendEvent,
    runVersion: number
  ): Promise<JourneySendResult<TContext, TStepId, TStepMeta>> => {
    if (snapshot.status !== JOURNEY_STATUS.RUNNING) {
      return buildCanceledSendResult();
    }

    const fromStep = snapshot.currentStepId;
    const transitionEvent = event as RuntimeTransitionEvent;
    emit({ type: "transition.start", from: fromStep, event, timestamp: now() });

    const transitionResolution = resolveTransitionsForSend(event, fromStep, runVersion);
    if (transitionResolution.earlyResult) {
      return transitionResolution.earlyResult;
    }

    const selectionResolution = await selectTransitionForSend(
      transitionResolution.transitionsToEvaluate,
      transitionEvent,
      fromStep,
      runVersion
    );
    if (selectionResolution.earlyResult) {
      return selectionResolution.earlyResult;
    }

    if (!isRunActive(runVersion)) {
      return buildCanceledSendResult();
    }

    const { transition } = selectionResolution;
    if (!transition) {
      return handleNoTransitionMatch(event, fromStep);
    }

    const contextResolution = await resolveNextContext(
      transition,
      transitionEvent,
      fromStep,
      runVersion
    );
    if (contextResolution.earlyResult) {
      return contextResolution.earlyResult;
    }

    setStepIdle(fromStep, runVersion);

    const target = resolveTransitionTarget(transition);
    if (isTerminalTarget(target)) {
      return commitTerminalTransition(
        fromStep,
        target,
        transitionEvent,
        transition.id ?? null,
        contextResolution.nextContext
      );
    }

    return commitStepTransition(
      fromStep,
      target,
      transitionEvent,
      transition,
      contextResolution.nextContext
    );
  };

  const machine: JourneyMachine<TContext, TStepId, TEventType, TPayloadMap, TStepMeta> = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      if (isDisposed) {
        return () => undefined;
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribeSelector: <TSelected>(
      selector: JourneySelector<TContext, TStepId, TStepMeta, TSelected>,
      listener: (next: TSelected, previous: TSelected) => void,
      equalityFn?: JourneyEqualityFn<TSelected>
    ) => {
      if (isDisposed) {
        return () => undefined;
      }

      const isEqual = equalityFn ?? Object.is;
      let selected = selector(snapshot);

      return machine.subscribe(() => {
        const nextSelected = selector(snapshot);
        if (isEqual(selected, nextSelected)) {
          return;
        }

        const previous = selected;
        selected = nextSelected;
        listener(nextSelected, previous);
      });
    },
    subscribeEvent: (listener) => {
      if (isDisposed) {
        return () => undefined;
      }
      eventListeners.add(listener);
      try {
        listener(startupEvent);
      } catch (error) {
        eventListeners.delete(listener);
        throw error;
      }
      return () => {
        eventListeners.delete(listener);
      };
    },
    subscribeStart: (listener) =>
      machine.subscribeEvent((event) => {
        if (event.type === "journey.start") {
          listener(event);
        }
      }),
    subscribeComplete: (listener) =>
      machine.subscribeEvent((event) => {
        if (event.type === "journey.complete") {
          listener(event);
        }
      }),
    subscribeTerminate: (listener) =>
      machine.subscribeEvent((event) => {
        if (event.type === "journey.close") {
          listener(event);
        }
      }),
    resetMachine: () => {
      if (isDisposed) {
        return snapshot;
      }

      cancelInFlight();
      snapshot = buildSnapshot(
        [resolvedJourney.initial],
        0,
        resolvedJourney.context,
        JOURNEY_STATUS.RUNNING,
        buildInitialAsyncState(resolvedJourney.steps),
        buildStepMeta()
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
      if (isDisposed) {
        return snapshot;
      }

      snapshot = {
        ...snapshot,
        context: updater(snapshot.context)
      };
      persistSnapshot(snapshot);
      notify();
      return snapshot;
    },
    updateStepMetadata: (stepId, updater) => {
      if (isDisposed) {
        return snapshot;
      }

      if (!(stepId in resolvedJourney.steps)) {
        return snapshot;
      }

      const previousMeta = snapshot.stepMeta[stepId];
      const nextMeta = updater(previousMeta);
      if (Object.is(previousMeta, nextMeta)) {
        return snapshot;
      }

      snapshot = {
        ...snapshot,
        stepMeta: {
          ...snapshot.stepMeta,
          [stepId]: nextMeta
        }
      };
      persistSnapshot(snapshot);
      notify();
      emit({
        type: "metadata.updated",
        stepId,
        previous: previousMeta,
        next: nextMeta,
        timestamp: now()
      });
      return snapshot;
    },
    clearStepError: (stepId) => {
      if (isDisposed) {
        return snapshot;
      }

      const resolvedStep = stepId ?? snapshot.currentStepId;
      if (!(resolvedStep in resolvedJourney.steps)) {
        return snapshot;
      }

      setStepIdle(resolvedStep);
      return snapshot;
    },
    dispose: () => {
      if (isDisposed) {
        return;
      }

      isDisposed = true;
      cancelInFlight();
      listeners.clear();
      eventListeners.clear();
    },
    goToPreviousStep: (steps) =>
      queue(
        async () => {
          const result = applyPreviousNavigation(steps, "goToPreviousStep");
          return result;
        },
        () => buildSendResult(snapshot, false)
      ),
    goToLastVisitedStep: () =>
      queue(
        async () => {
          const result = applyLastVisitedNavigation("goToLastVisitedStep");
          return result;
        },
        () => buildSendResult(snapshot, false)
      ),
    goToNextStep: () => machine.send({ type: "goToNextStep" }),
    terminateJourney: (payload) =>
      payload === undefined
        ? machine.send({ type: "terminateJourney" })
        : machine.send({ type: "terminateJourney", payload }),
    completeJourney: (payload) =>
      payload === undefined
        ? machine.send({ type: "completeJourney" })
        : machine.send({ type: "completeJourney", payload }),
    send: (event) =>
      queue(async (runVersion) => executeSend(event, runVersion), buildCanceledSendResult)
  };

  return machine;
}
