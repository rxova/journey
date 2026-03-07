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
    const { machine } = useJourneyStore("useJourneyApi");

    return React.useMemo(
      () => ({
        send: async (
          event: JourneySendEvent<TStepId, JourneyEventType<TCustomEvent>, TEventPayloadMap>
        ) => {
          await machine.send(event);
        },
        goToNextStep: async () => {
          await machine.goToNextStep();
        },
        terminateJourney: async (
          payload?: JourneyPayloadFor<
            JourneyEventType<TCustomEvent>,
            TEventPayloadMap,
            "terminateJourney"
          >
        ) => {
          await machine.terminateJourney(payload);
        },
        completeJourney: async (
          payload?: JourneyPayloadFor<
            JourneyEventType<TCustomEvent>,
            TEventPayloadMap,
            "completeJourney"
          >
        ) => {
          await machine.completeJourney(payload);
        },
        goToPreviousStep: async (steps?: number) => {
          await machine.goToPreviousStep(steps);
        },
        goToLastVisitedStep: async () => {
          await machine.goToLastVisitedStep();
        },
        clearStepError: (stepId?: TStepId) => {
          machine.clearStepError(stepId);
        },
        updateContext: (updater: (context: TContext) => TContext) => {
          machine.updateContext(updater);
        },
        updateStepMetadata: (stepId: TStepId, updater: (metadata: TStepMeta) => TStepMeta) => {
          machine.updateStepMetadata(stepId, updater);
        },
        resetJourney: () => {
          machine.resetMachine();
        }
      }),
      [machine]
    );
  };
};
