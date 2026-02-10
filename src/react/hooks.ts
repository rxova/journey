import React from "react";

import { JOURNEY_EVENT } from "@/src/core";
import type { JourneyEvent, JourneyPayloadFor, JourneySnapshot } from "@/src/core";
import { useJourneyStore } from "@/src/react/context";
import type {
  JourneyDefaultEvent,
  JourneyEventType,
  JourneyHookResult,
  JourneyReactEventPayloadMap
} from "@/src/react/types";

const useSnapshot = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>
>(): JourneySnapshot<TContext, TStepId> => {
  const { machine } = useJourneyStore<TContext, TStepId, TCustomEvent, TEventPayloadMap>(
    "useJourneySnapshot"
  );

  return React.useSyncExternalStore(machine.subscribe, machine.getSnapshot, machine.getSnapshot);
};

export const useJourneySnapshot = useSnapshot;

export const useJourneyApi = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>
>() => {
  const { machine } = useJourneyStore<TContext, TStepId, TCustomEvent, TEventPayloadMap>(
    "useJourneyApi"
  );

  const send = React.useCallback(
    async (event: JourneyEvent<TStepId, JourneyEventType<TCustomEvent>, TEventPayloadMap>) => {
      await machine.send(event);
    },
    [machine]
  );

  const goTo = React.useCallback(
    async (
      stepId: TStepId,
      payload?: JourneyPayloadFor<
        JourneyEventType<TCustomEvent>,
        TEventPayloadMap,
        (typeof JOURNEY_EVENT)["GO_TO"]
      >
    ) => {
      if (payload === undefined) {
        await machine.send({
          type: JOURNEY_EVENT.GO_TO,
          to: stepId
        } as JourneyEvent<TStepId, JourneyEventType<TCustomEvent>, TEventPayloadMap>);
        return;
      }

      await machine.send({
        type: JOURNEY_EVENT.GO_TO,
        to: stepId,
        payload
      } as JourneyEvent<TStepId, JourneyEventType<TCustomEvent>, TEventPayloadMap>);
    },
    [machine]
  );

  const sendDefault = React.useCallback(
    async <TType extends JourneyDefaultEvent>(
      type: TType,
      payload?: JourneyPayloadFor<JourneyEventType<TCustomEvent>, TEventPayloadMap, TType>
    ) => {
      const event =
        payload === undefined
          ? ({ type } as unknown as JourneyEvent<
              TStepId,
              JourneyEventType<TCustomEvent>,
              TEventPayloadMap
            >)
          : ({
              type,
              payload
            } as unknown as JourneyEvent<
              TStepId,
              JourneyEventType<TCustomEvent>,
              TEventPayloadMap
            >);
      await machine.send(event);
    },
    [machine]
  );

  const next = React.useCallback(
    async (
      payload?: JourneyPayloadFor<JourneyEventType<TCustomEvent>, TEventPayloadMap, "next">
    ) => {
      await sendDefault("next", payload);
    },
    [sendDefault]
  );

  const back = React.useCallback(
    async (
      payload?: JourneyPayloadFor<JourneyEventType<TCustomEvent>, TEventPayloadMap, "back">
    ) => {
      await sendDefault("back", payload);
    },
    [sendDefault]
  );

  const close = React.useCallback(
    async (
      payload?: JourneyPayloadFor<JourneyEventType<TCustomEvent>, TEventPayloadMap, "close">
    ) => {
      await sendDefault("close", payload);
    },
    [sendDefault]
  );

  const submit = React.useCallback(
    async (
      payload?: JourneyPayloadFor<JourneyEventType<TCustomEvent>, TEventPayloadMap, "submit">
    ) => {
      await sendDefault("submit", payload);
    },
    [sendDefault]
  );

  const updateContext = React.useCallback(
    (updater: (context: TContext) => TContext) => {
      machine.updateContext(updater);
    },
    [machine]
  );

  const clearStepError = React.useCallback(
    (stepId?: TStepId) => {
      machine.clearStepError(stepId);
    },
    [machine]
  );

  const reset = React.useCallback(() => {
    machine.reset();
  }, [machine]);

  const trimHistory = React.useCallback(
    (maxHistory?: number) => {
      machine.trimHistory(maxHistory);
    },
    [machine]
  );

  const clearHistory = React.useCallback(() => {
    machine.clearHistory();
  }, [machine]);

  return {
    send,
    goTo,
    next,
    back,
    close,
    submit,
    clearStepError,
    updateContext,
    reset,
    trimHistory,
    clearHistory
  };
};

export const useJourney = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>
>(): JourneyHookResult<TContext, TStepId, TCustomEvent, TEventPayloadMap> => {
  useJourneyStore<TContext, TStepId, TCustomEvent, TEventPayloadMap>("useJourney");
  const snapshot = useJourneySnapshot<TContext, TStepId, TCustomEvent, TEventPayloadMap>();
  const api = useJourneyApi<TContext, TStepId, TCustomEvent, TEventPayloadMap>();

  return {
    snapshot,
    api
  };
};
