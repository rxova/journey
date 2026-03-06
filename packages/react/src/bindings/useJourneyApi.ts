import React from "react";

import type { JourneyPayloadFor, JourneySendEvent } from "@rxova/journey-core";
import type { JourneyEventType, JourneyReactEventPayloadMap, JourneyStoreValue } from "../types";

type UseJourneyStore<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
> = (
  hookName?: string
) => JourneyStoreValue<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>;

export const createUseJourneyApi = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
>(
  useJourneyStore: UseJourneyStore<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>
) => {
  return () => {
    const machine = useJourneyStore("useJourneyApi").machine;

    const send = React.useCallback(
      async (
        event: JourneySendEvent<TStepId, JourneyEventType<TCustomEvent>, TEventPayloadMap>
      ) => {
        await machine.send(event);
      },
      [machine]
    );

    const goToNextStep = React.useCallback(async () => {
      await machine.goToNextStep();
    }, [machine]);

    const terminateJourney = React.useCallback(
      async (
        payload?: JourneyPayloadFor<
          JourneyEventType<TCustomEvent>,
          TEventPayloadMap,
          "terminateJourney"
        >
      ) => {
        await machine.terminateJourney(payload);
      },
      [machine]
    );

    const completeJourney = React.useCallback(
      async (
        payload?: JourneyPayloadFor<
          JourneyEventType<TCustomEvent>,
          TEventPayloadMap,
          "completeJourney"
        >
      ) => {
        await machine.completeJourney(payload);
      },
      [machine]
    );

    const goToPreviousStep = React.useCallback(
      async (steps?: number) => {
        await machine.goToPreviousStep(steps);
      },
      [machine]
    );

    const goToLastVisitedStep = React.useCallback(async () => {
      await machine.goToLastVisitedStep();
    }, [machine]);

    const updateContext = React.useCallback(
      (updater: (context: TContext) => TContext) => {
        machine.updateContext(updater);
      },
      [machine]
    );

    const updateStepMetadata = React.useCallback(
      (stepId: TStepId, updater: (metadata: TStepMeta) => TStepMeta) => {
        machine.updateStepMetadata(stepId, updater);
      },
      [machine]
    );

    const clearStepError = React.useCallback(
      (stepId?: TStepId) => {
        machine.clearStepError(stepId);
      },
      [machine]
    );

    const resetJourney = React.useCallback(() => {
      machine.resetMachine();
    }, [machine]);

    return React.useMemo(
      () => ({
        send,
        goToNextStep,
        terminateJourney,
        completeJourney,
        goToPreviousStep,
        goToLastVisitedStep,
        clearStepError,
        updateContext,
        updateStepMetadata,
        updateComponentMetadata: updateStepMetadata,
        resetJourney
      }),
      [
        send,
        goToNextStep,
        terminateJourney,
        completeJourney,
        goToPreviousStep,
        goToLastVisitedStep,
        clearStepError,
        updateContext,
        updateStepMetadata,
        resetJourney
      ]
    );
  };
};
