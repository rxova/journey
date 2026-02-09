import React from "react";

import { createFlowMachine } from "@/src/core";
import type { FlowProviderProps, FlowStoreValue } from "@/src/react/types";

const FlowContext = React.createContext<FlowStoreValue<unknown, string, string> | null>(null);

export const FlowProvider = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never
>({
  flow,
  machine,
  persistence,
  children
}: FlowProviderProps<TContext, TStepId, TCustomEvent>) => {
  const resolvedMachine = React.useMemo(
    () => machine ?? createFlowMachine(flow, persistence ? { persistence } : undefined),
    [flow, machine, persistence]
  );

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
