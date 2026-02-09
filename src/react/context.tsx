import React from "react";

import { createFlowMachine, type FlowMachine } from "../core";
import type { FlowEventType, FlowReactFlow, FlowStoreValue } from "./types";

type ProviderProps<TContext, TStepId extends string, TCustomEvent extends string = never> = {
  flow: FlowReactFlow<TContext, TStepId, TCustomEvent>;
  machine?: FlowMachine<TContext, TStepId, FlowEventType<TCustomEvent>>;
  children: React.ReactNode;
};

const FlowContext = React.createContext<FlowStoreValue<unknown, string, string> | null>(null);

export const FlowProvider = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never
>({
  flow,
  machine,
  children
}: ProviderProps<TContext, TStepId, TCustomEvent>) => {
  const resolvedMachine = React.useMemo(() => machine ?? createFlowMachine(flow), [flow, machine]);

  return (
    <FlowContext.Provider
      value={
        {
          machine: resolvedMachine,
          flow
        } as unknown as FlowStoreValue<unknown, string, string>
      }
    >
      {children}
    </FlowContext.Provider>
  );
};

export const useFlowStore = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never
>(): FlowStoreValue<TContext, TStepId, TCustomEvent> => {
  const value = React.useContext(FlowContext);
  if (!value) {
    throw new Error("useFlow* hooks must be used within <FlowProvider>.");
  }

  return value as unknown as FlowStoreValue<TContext, TStepId, TCustomEvent>;
};
