import type { JourneyEvent, JourneyPayloadFor } from "@rxova/journey-core";
import type { JourneyEventType, JourneyStoreValue, JourneyVueEventPayloadMap } from "../types";

type UseJourneyStore<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyVueEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
> = (
  hookName?: string
) => JourneyStoreValue<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>;

export const createUseJourneyApi = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyVueEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
>(
  useJourneyStore: UseJourneyStore<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>
) => {
  return () => {
    const store = useJourneyStore("useJourneyApi");

    const send = async (
      event: JourneyEvent<TStepId, JourneyEventType<TCustomEvent>, TEventPayloadMap>
    ) => {
      await store.machine.send(event);
    };

    const goToNextStep = async () => {
      await store.machine.goToNextStep();
    };

    const terminateJourney = async (
      payload?: JourneyPayloadFor<
        JourneyEventType<TCustomEvent>,
        TEventPayloadMap,
        "terminateJourney"
      >
    ) => {
      await store.machine.terminateJourney(payload);
    };

    const completeJourney = async (
      payload?: JourneyPayloadFor<
        JourneyEventType<TCustomEvent>,
        TEventPayloadMap,
        "completeJourney"
      >
    ) => {
      await store.machine.completeJourney(payload);
    };

    const goToPreviousStep = async (steps?: number) => {
      await store.machine.goToPreviousStep(steps);
    };

    const goToLastVisitedStep = async () => {
      await store.machine.goToLastVisitedStep();
    };

    const updateContext = (updater: (context: TContext) => TContext) => {
      store.machine.updateContext(updater);
    };

    const updateStepMetadata = (stepId: TStepId, updater: (metadata: TStepMeta) => TStepMeta) => {
      store.machine.updateStepMetadata(stepId, updater);
    };

    const clearStepError = (stepId?: TStepId) => {
      store.machine.clearStepError(stepId);
    };

    const resetJourney = () => {
      store.machine.resetMachine();
    };

    return {
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
    };
  };
};
