import React from "react";

import { createJourneyMachine } from "@rxova/journey-core";
import type {
  JourneyBindingsProviderProps,
  JourneyReactDefinition,
  JourneyReactEventPayloadMap,
  JourneyStoreValue
} from "../types";

const useSafeLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

type ProviderFactoryProps<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
> = {
  JourneyContext: React.Context<JourneyStoreValue<
    TContext,
    TStepId,
    TCustomEvent,
    TEventPayloadMap,
    TStepMeta
  > | null>;
  boundJourney: JourneyReactDefinition<
    TContext,
    TStepId,
    TCustomEvent,
    TEventPayloadMap,
    TStepMeta
  >;
};

export const createProvider = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
>({
  JourneyContext,
  boundJourney
}: ProviderFactoryProps<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>) => {
  const Provider = ({
    journey,
    machine,
    persistence,
    completeOnNoNextStep,
    resetOnJourneyChange = false,
    resetOnPersistenceChange = false,
    onStart,
    onComplete,
    onTerminate,
    children
  }: JourneyBindingsProviderProps<
    TContext,
    TStepId,
    TCustomEvent,
    TEventPayloadMap,
    TStepMeta
  >) => {
    const incomingJourney = journey ?? boundJourney;
    const internalMachineRef = React.useRef<
      | JourneyStoreValue<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>["machine"]
      | null
    >(null);
    const journeyRef = React.useRef(incomingJourney);
    const persistenceRef = React.useRef(persistence);
    const completeOnNoNextStepRef = React.useRef(completeOnNoNextStep);
    const onStartRef = React.useRef(onStart);
    const onCompleteRef = React.useRef(onComplete);
    const onTerminateRef = React.useRef(onTerminate);
    const [, forceUpdate] = React.useReducer((count: number) => count + 1, 0);
    const hasOnStart = onStart !== undefined;
    const hasOnComplete = onComplete !== undefined;
    const hasOnTerminate = onTerminate !== undefined;

    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
    onTerminateRef.current = onTerminate;

    if (!machine && !internalMachineRef.current) {
      const options =
        persistence !== undefined || completeOnNoNextStep !== undefined
          ? {
              ...(persistence !== undefined ? { persistence } : {}),
              ...(completeOnNoNextStep !== undefined ? { completeOnNoNextStep } : {})
            }
          : undefined;
      internalMachineRef.current = createJourneyMachine(incomingJourney, options);
      journeyRef.current = incomingJourney;
      persistenceRef.current = persistence;
      completeOnNoNextStepRef.current = completeOnNoNextStep;
    }

    const shouldResetJourney =
      !machine && resetOnJourneyChange && journeyRef.current !== incomingJourney;
    const shouldResetPersistence =
      !machine && resetOnPersistenceChange && persistenceRef.current !== persistence;
    const shouldResetNextCompletion =
      !machine && completeOnNoNextStepRef.current !== completeOnNoNextStep;

    useSafeLayoutEffect(() => {
      if (
        machine ||
        (!shouldResetJourney && !shouldResetPersistence && !shouldResetNextCompletion)
      ) {
        return;
      }

      const previousInternalMachine = internalMachineRef.current;
      const options =
        persistence !== undefined || completeOnNoNextStep !== undefined
          ? {
              ...(persistence !== undefined ? { persistence } : {}),
              ...(completeOnNoNextStep !== undefined ? { completeOnNoNextStep } : {})
            }
          : undefined;
      const nextInternalMachine = createJourneyMachine(incomingJourney, options);
      internalMachineRef.current = nextInternalMachine;
      journeyRef.current = incomingJourney;
      persistenceRef.current = persistence;
      completeOnNoNextStepRef.current = completeOnNoNextStep;

      if (previousInternalMachine && previousInternalMachine !== nextInternalMachine) {
        previousInternalMachine.dispose();
      }

      forceUpdate();
    }, [
      completeOnNoNextStep,
      incomingJourney,
      machine,
      persistence,
      shouldResetJourney,
      shouldResetPersistence,
      shouldResetNextCompletion
    ]);

    const resolvedMachine = machine ?? internalMachineRef.current!;
    const resolvedJourney = machine ? incomingJourney : journeyRef.current;
    const value = React.useMemo<
      JourneyStoreValue<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>
    >(
      () => ({
        machine: resolvedMachine,
        journey: resolvedJourney
      }),
      [resolvedMachine, resolvedJourney]
    );

    React.useEffect(() => {
      if (!hasOnStart && !hasOnComplete && !hasOnTerminate) {
        return;
      }

      const unsubStart = hasOnStart
        ? resolvedMachine.subscribeStart((event) => {
            onStartRef.current?.(event);
          })
        : undefined;

      const unsubComplete = hasOnComplete
        ? resolvedMachine.subscribeComplete((event) => {
            onCompleteRef.current?.(event);
          })
        : undefined;

      const unsubTerminate = hasOnTerminate
        ? resolvedMachine.subscribeTerminate((event) => {
            onTerminateRef.current?.(event);
          })
        : undefined;

      return () => {
        unsubStart?.();
        unsubComplete?.();
        unsubTerminate?.();
      };
    }, [hasOnStart, hasOnComplete, hasOnTerminate, resolvedMachine]);

    React.useEffect(() => {
      return () => {
        if (machine || !internalMachineRef.current) {
          return;
        }
        internalMachineRef.current.dispose();
        internalMachineRef.current = null;
      };
    }, [machine]);

    return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
  };

  return Provider;
};
