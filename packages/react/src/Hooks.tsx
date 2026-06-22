import React from "react";

import type {
  JourneyBuilderCustomEventKey,
  JourneyComputed,
  JourneyEqualityFn,
  JourneyJsonObject,
  JourneyMachinePlugin,
  JourneyMachineWithPlugins,
  JourneyObservationEvent,
  JourneySelector,
  JourneySnapshot,
  JourneyStepAsyncState
} from "@rxova/journey-core";
import type { JourneyApi, StepScopedJourneyApi } from "./types";
import type { SelectorCache } from "./type-helpers";
import type { JourneyBaseEvent, JourneyEmpty } from "@rxova/journey-core";

const useSafeLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

const IDLE_STEP_ASYNC_STATE: JourneyStepAsyncState = {
  phase: "idle",
  eventType: null,
  transitionId: null,
  error: null
};

const isSameStepAsyncState = (a: JourneyStepAsyncState, b: JourneyStepAsyncState): boolean =>
  a.phase === b.phase &&
  a.eventType === b.eventType &&
  a.transitionId === b.transitionId &&
  Object.is(a.error, b.error);

export const createJourneyHooks = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TPlugins extends readonly JourneyMachinePlugin[] = [],
  TStepHandledCustomEventMap extends Record<TStepId, JourneyBuilderCustomEventKey<TEvents>> =
    Record<TStepId, never>,
  TGlobalHandledCustomEventType extends JourneyBuilderCustomEventKey<TEvents> = never
>(
  machine: JourneyMachineWithPlugins<TContext, TStepId, TEvents, TStepMeta, THandlers, TPlugins>
) => {
  const useJourneySnapshot = (): JourneySnapshot<TContext, TStepId> => {
    const runtimeMachine = machine;
    const getSnapshot = React.useCallback(() => runtimeMachine.getSnapshot(), [runtimeMachine]);
    const subscribe = React.useCallback(
      (onStoreChange: () => void) => runtimeMachine.subscribe(onStoreChange),
      [runtimeMachine]
    );

    return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  };

  const useJourneyComputed = (): JourneyComputed<TStepId> => {
    const snapshot = useJourneySnapshot();
    const runtimeMachine = machine;
    return React.useMemo(() => {
      void snapshot;
      return runtimeMachine.getComputed();
    }, [runtimeMachine, snapshot]);
  };

  const useJourneySelector = <TSelected,>(
    selector: JourneySelector<TContext, TStepId, TSelected>,
    equalityFn?: JourneyEqualityFn<TSelected>
  ): TSelected => {
    const runtimeMachine = machine;
    const isEqual = equalityFn ?? Object.is;
    const cacheRef = React.useRef<SelectorCache<TContext, TStepId, TSelected> | null>(null);

    const getSelectedSnapshot = React.useCallback(() => {
      const nextSnapshot = runtimeMachine.getSnapshot();
      const cached = cacheRef.current;

      if (
        cached &&
        Object.is(cached.machine, runtimeMachine) &&
        Object.is(cached.selector, selector) &&
        Object.is(cached.isEqual, isEqual) &&
        Object.is(cached.snapshot, nextSnapshot)
      ) {
        return cached.selected;
      }

      const nextSelected = selector(nextSnapshot);

      if (
        cached &&
        Object.is(cached.machine, runtimeMachine) &&
        Object.is(cached.selector, selector) &&
        Object.is(cached.isEqual, isEqual) &&
        isEqual(cached.selected, nextSelected)
      ) {
        cacheRef.current = {
          machine: runtimeMachine,
          snapshot: nextSnapshot,
          selected: cached.selected,
          selector,
          isEqual
        };
        return cached.selected;
      }

      cacheRef.current = {
        machine: runtimeMachine,
        snapshot: nextSnapshot,
        selected: nextSelected,
        selector,
        isEqual
      };
      return nextSelected;
    }, [runtimeMachine, isEqual, selector]);

    const subscribeToSelectedSnapshot = React.useCallback(
      (onStoreChange: () => void) =>
        runtimeMachine.subscribeSelector(
          selector,
          () => {
            onStoreChange();
          },
          isEqual
        ),
      [runtimeMachine, isEqual, selector]
    );

    return React.useSyncExternalStore(
      subscribeToSelectedSnapshot,
      getSelectedSnapshot,
      getSelectedSnapshot
    );
  };

  const useJourneyEvent = (
    listener: (event: JourneyObservationEvent<TStepId, TEvents>) => void
  ): void => {
    const runtimeMachine = machine;
    const listenerRef = React.useRef(listener);
    listenerRef.current = listener;

    useSafeLayoutEffect(() => {
      return runtimeMachine.subscribeEvent((event) => {
        listenerRef.current(event);
      });
    }, [runtimeMachine]);
  };

  const useJourneyStepLifecycle = (
    stepId: TStepId,
    callbacks: {
      onEnter?: (args: { context: TContext }) => void;
      onLeave?: (args: { context: TContext }) => void;
    }
  ): void => {
    useJourneyEvent((event) => {
      if (event.type === "step.enter" && event.stepId === stepId) {
        callbacks.onEnter?.({ context: machine.getSnapshot().context });
      } else if (event.type === "step.exit" && event.stepId === stepId) {
        callbacks.onLeave?.({ context: machine.getSnapshot().context });
      }
    });
  };

  const useStepAsyncState = (stepId: TStepId): JourneyStepAsyncState =>
    useJourneySelector(
      (snapshot) => snapshot.async.byStep[stepId] ?? IDLE_STEP_ASYNC_STATE,
      isSameStepAsyncState
    );

  const useJourneyApi = (): JourneyApi<TContext, TStepId, TEvents, TStepMeta> => {
    const runtimeMachine = machine;
    return React.useMemo(
      () => ({
        startJourney: runtimeMachine.startJourney,
        send: runtimeMachine.send,
        goToNextStep: runtimeMachine.goToNextStep,
        goToStepById: runtimeMachine.goToStepById,
        terminateJourney: runtimeMachine.terminateJourney,
        completeJourney: runtimeMachine.completeJourney,
        goToPreviousStep: runtimeMachine.goToPreviousStep,
        goToLastVisitedStep: runtimeMachine.goToLastVisitedStep,
        clearStepError: runtimeMachine.clearStepError,
        updateContext: runtimeMachine.updateContext,
        getStepMeta: runtimeMachine.getStepMeta,
        resetJourney: () => runtimeMachine.resetJourney()
      }),
      [runtimeMachine]
    );
  };

  const useStepApi = <TStepKey extends TStepId>(
    stepId: TStepKey
  ): StepScopedJourneyApi<
    TContext,
    TStepId,
    TEvents,
    Extract<TStepHandledCustomEventMap[TStepKey] | TGlobalHandledCustomEventType, TEvents["type"]>,
    TStepMeta
  > => {
    const runtimeMachine = machine;
    void stepId;
    return React.useMemo(
      () => ({
        startJourney: runtimeMachine.startJourney,
        send: runtimeMachine.send,
        goToNextStep: runtimeMachine.goToNextStep,
        goToStepById: runtimeMachine.goToStepById,
        terminateJourney: runtimeMachine.terminateJourney,
        completeJourney: runtimeMachine.completeJourney,
        goToPreviousStep: runtimeMachine.goToPreviousStep,
        goToLastVisitedStep: runtimeMachine.goToLastVisitedStep,
        clearStepError: runtimeMachine.clearStepError,
        updateContext: runtimeMachine.updateContext,
        getStepMeta: runtimeMachine.getStepMeta,
        resetJourney: () => runtimeMachine.resetJourney()
      }),
      [runtimeMachine]
    ) as StepScopedJourneyApi<
      TContext,
      TStepId,
      TEvents,
      Extract<
        TStepHandledCustomEventMap[TStepKey] | TGlobalHandledCustomEventType,
        TEvents["type"]
      >,
      TStepMeta
    >;
  };

  return {
    useJourneySnapshot,
    useJourneyComputed,
    useJourneySelector,
    useStepAsyncState,
    useJourneyApi,
    useStepApi,
    useJourneyEvent,
    useJourneyStepLifecycle
  };
};
