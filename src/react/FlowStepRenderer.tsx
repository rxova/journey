import React from "react";

import { useFlowStore } from "./context";
import { useFlowSnapshot } from "./hooks";

type FlowStepRendererProps = {
  fallback?: React.ReactNode;
};

export const FlowStepRenderer = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never
>({
  fallback = null
}: FlowStepRendererProps) => {
  const snapshot = useFlowSnapshot<TContext, TStepId, TCustomEvent>();
  const { flow } = useFlowStore<TContext, TStepId, TCustomEvent>();

  const StepComponent = flow.steps[snapshot.current]?.component;

  if (!StepComponent) {
    return <>{fallback}</>;
  }

  return <StepComponent />;
};
