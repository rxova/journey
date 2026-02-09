import React from "react";

import type { FlowEvent, FlowSnapshot } from "../core";
import { useFlowStore } from "./context";
import type { FlowHookResult } from "./types";

const useSnapshot = <TContext, TStepId extends string, TEventType extends string>(): FlowSnapshot<TContext, TStepId> => {
  const { machine } = useFlowStore<TContext, TStepId, TEventType>();

  return React.useSyncExternalStore(machine.subscribe, machine.getSnapshot, machine.getSnapshot);
};

export const useFlowSnapshot = useSnapshot;

export const useFlowApi = <
  TContext,
  TStepId extends string,
  TEventType extends string
>() => {
  const { machine } = useFlowStore<TContext, TStepId, TEventType>();

  const send = React.useCallback(async (event: FlowEvent<TStepId, TEventType>) => {
    await machine.send(event);
  }, [machine]);

  const goTo = React.useCallback(async (stepId: TStepId, payload?: unknown) => {
    await machine.send({ type: "goTo", to: stepId, payload });
  }, [machine]);

  const next = React.useCallback(async (payload?: unknown) => {
    await machine.send({ type: "next" as TEventType, payload });
  }, [machine]);

  const back = React.useCallback(async (payload?: unknown) => {
    await machine.send({ type: "back" as TEventType, payload });
  }, [machine]);

  const close = React.useCallback(async (payload?: unknown) => {
    await machine.send({ type: "close" as TEventType, payload });
  }, [machine]);

  const submit = React.useCallback(async (payload?: unknown) => {
    await machine.send({ type: "submit" as TEventType, payload });
  }, [machine]);

  const updateContext = React.useCallback((updater: (context: TContext) => TContext) => {
    machine.updateContext(updater);
  }, [machine]);

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
  TEventType extends string
>(): FlowHookResult<TContext, TStepId, TEventType> => {
  const snapshot = useFlowSnapshot<TContext, TStepId, TEventType>();
  const api = useFlowApi<TContext, TStepId, TEventType>();

  return {
    snapshot,
    api
  };
};
