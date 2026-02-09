import React from "react";

import type { FlowEvent, FlowSnapshot } from "../core";
import { useFlowStore } from "./context";
import type { FlowEventType, FlowHookResult } from "./types";

const useSnapshot = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never
>(): FlowSnapshot<TContext, TStepId> => {
  const { machine } = useFlowStore<TContext, TStepId, TCustomEvent>();

  return React.useSyncExternalStore(machine.subscribe, machine.getSnapshot, machine.getSnapshot);
};

export const useFlowSnapshot = useSnapshot;

export const useFlowApi = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never
>() => {
  const { machine } = useFlowStore<TContext, TStepId, TCustomEvent>();

  const send = React.useCallback(
    async (event: FlowEvent<TStepId, FlowEventType<TCustomEvent>>) => {
      await machine.send(event);
    },
    [machine]
  );

  const goTo = React.useCallback(
    async (stepId: TStepId, payload?: unknown) => {
      await machine.send({ type: "goTo", to: stepId, payload });
    },
    [machine]
  );

  const sendDefault = React.useCallback(
    async (type: "next" | "back" | "close" | "submit", payload?: unknown) => {
      await machine.send({ type, payload });
    },
    [machine]
  );

  const next = React.useCallback(
    async (payload?: unknown) => {
      await sendDefault("next", payload);
    },
    [sendDefault]
  );

  const back = React.useCallback(
    async (payload?: unknown) => {
      await sendDefault("back", payload);
    },
    [sendDefault]
  );

  const close = React.useCallback(
    async (payload?: unknown) => {
      await sendDefault("close", payload);
    },
    [sendDefault]
  );

  const submit = React.useCallback(
    async (payload?: unknown) => {
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
    updateContext,
    reset
  };
};

export const useFlow = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never
>(): FlowHookResult<TContext, TStepId, TCustomEvent> => {
  const snapshot = useFlowSnapshot<TContext, TStepId, TCustomEvent>();
  const api = useFlowApi<TContext, TStepId, TCustomEvent>();

  return {
    snapshot,
    api
  };
};
