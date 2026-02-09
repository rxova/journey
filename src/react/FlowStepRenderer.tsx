import React from "react";

import { useFlowStore } from "./context";
import { useFlowSnapshot } from "./hooks";

type FlowStepRendererProps = {
  fallback?: React.ReactNode;
};

export const FlowStepRenderer = <
  TContext,
  TStepId extends string,
  TEventType extends string
>({ fallback = null }: FlowStepRendererProps) => {
  const snapshot = useFlowSnapshot<TContext, TStepId, TEventType>();
  const { flow } = useFlowStore<TContext, TStepId, TEventType>();

  const StepComponent = flow.steps[snapshot.current]?.component;

  if (!StepComponent) {
    return <>{fallback}</>;
  }

  return <StepComponent />;
};
