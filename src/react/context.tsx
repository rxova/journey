import React from "react";

import { createFlowMachine, type FlowMachine } from "../core";
import type { FlowReactFlow, FlowStoreValue } from "./types";

type ProviderProps<TContext, TStepId extends string, TEventType extends string> = {
  flow: FlowReactFlow<TContext, TStepId, TEventType>;
  machine?: FlowMachine<TContext, TStepId, TEventType>;
  children: React.ReactNode;
};

const FlowContext = React.createContext<FlowStoreValue<any, any, any> | null>(null);

export const FlowProvider = <
  TContext,
  TStepId extends string,
  TEventType extends string
>({ flow, machine, children }: ProviderProps<TContext, TStepId, TEventType>) => {
  const internalMachineRef = React.useRef<FlowMachine<TContext, TStepId, TEventType> | null>(null);

  if (!internalMachineRef.current) {
    internalMachineRef.current = machine ?? createFlowMachine(flow);
  }

  return (
    <FlowContext.Provider
      value={{
        machine: internalMachineRef.current,
        flow
      }}
    >
      {children}
    </FlowContext.Provider>
  );
};

export const useFlowStore = <
  TContext,
  TStepId extends string,
  TEventType extends string
>(): FlowStoreValue<TContext, TStepId, TEventType> => {
  const value = React.useContext(FlowContext);
  if (!value) {
    throw new Error("useFlow* hooks must be used within <FlowProvider>.");
  }

  return value as FlowStoreValue<TContext, TStepId, TEventType>;
};
