import React from "react";

import { FLOW_EVENT } from "@/src/core";
import type { FlowEvent, FlowPayloadFor, FlowSnapshot } from "@/src/core";
import { useFlowStore } from "@/src/react/context";
import type {
  FlowDefaultEvent,
  FlowEventType,
  FlowHookResult,
  FlowReactEventPayloadMap
} from "@/src/react/types";

const useSnapshot = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends FlowReactEventPayloadMap<TCustomEvent> = Record<never, never>
>(): FlowSnapshot<TContext, TStepId> => {
  const { machine } = useFlowStore<TContext, TStepId, TCustomEvent, TEventPayloadMap>(
    "useFlowSnapshot"
  );

  return React.useSyncExternalStore(machine.subscribe, machine.getSnapshot, machine.getSnapshot);
};

export const useFlowSnapshot = useSnapshot;

export const useFlowApi = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends FlowReactEventPayloadMap<TCustomEvent> = Record<never, never>
>() => {
  const { machine } = useFlowStore<TContext, TStepId, TCustomEvent, TEventPayloadMap>("useFlowApi");

  const send = React.useCallback(
    async (event: FlowEvent<TStepId, FlowEventType<TCustomEvent>, TEventPayloadMap>) => {
      await machine.send(event);
    },
    [machine]
  );

  const goTo = React.useCallback(
    async (
      stepId: TStepId,
      payload?: FlowPayloadFor<
        FlowEventType<TCustomEvent>,
        TEventPayloadMap,
        (typeof FLOW_EVENT)["GO_TO"]
      >
    ) => {
      if (payload === undefined) {
        await machine.send({
          type: FLOW_EVENT.GO_TO,
          to: stepId
        } as FlowEvent<TStepId, FlowEventType<TCustomEvent>, TEventPayloadMap>);
        return;
      }

      await machine.send({
        type: FLOW_EVENT.GO_TO,
        to: stepId,
        payload
      } as FlowEvent<TStepId, FlowEventType<TCustomEvent>, TEventPayloadMap>);
    },
    [machine]
  );

  const sendDefault = React.useCallback(
    async <TType extends FlowDefaultEvent>(
      type: TType,
      payload?: FlowPayloadFor<FlowEventType<TCustomEvent>, TEventPayloadMap, TType>
    ) => {
      const event =
        payload === undefined
          ? ({ type } as unknown as FlowEvent<
              TStepId,
              FlowEventType<TCustomEvent>,
              TEventPayloadMap
            >)
          : ({
              type,
              payload
            } as unknown as FlowEvent<TStepId, FlowEventType<TCustomEvent>, TEventPayloadMap>);
      await machine.send(event);
    },
    [machine]
  );

  const next = React.useCallback(
    async (payload?: FlowPayloadFor<FlowEventType<TCustomEvent>, TEventPayloadMap, "next">) => {
      await sendDefault("next", payload);
    },
    [sendDefault]
  );

  const back = React.useCallback(
    async (payload?: FlowPayloadFor<FlowEventType<TCustomEvent>, TEventPayloadMap, "back">) => {
      await sendDefault("back", payload);
    },
    [sendDefault]
  );

  const close = React.useCallback(
    async (payload?: FlowPayloadFor<FlowEventType<TCustomEvent>, TEventPayloadMap, "close">) => {
      await sendDefault("close", payload);
    },
    [sendDefault]
  );

  const submit = React.useCallback(
    async (payload?: FlowPayloadFor<FlowEventType<TCustomEvent>, TEventPayloadMap, "submit">) => {
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

  return {
    send,
    goTo,
    next,
    back,
    close,
    submit,
    clearStepError,
    updateContext,
    reset
  };
};

export const useFlow = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends FlowReactEventPayloadMap<TCustomEvent> = Record<never, never>
>(): FlowHookResult<TContext, TStepId, TCustomEvent, TEventPayloadMap> => {
  useFlowStore<TContext, TStepId, TCustomEvent, TEventPayloadMap>("useFlow");
  const snapshot = useFlowSnapshot<TContext, TStepId, TCustomEvent, TEventPayloadMap>();
  const api = useFlowApi<TContext, TStepId, TCustomEvent, TEventPayloadMap>();

  return {
    snapshot,
    api
  };
};
