import React from "react";

import { useJourneyStore } from "./context";
import { useJourneySnapshot } from "./hooks";

type JourneyStepRendererProps = {
  fallback?: React.ReactNode;
};

export const JourneyStepRenderer = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never
>({
  fallback = null
}: JourneyStepRendererProps) => {
  const snapshot = useJourneySnapshot<TContext, TStepId, TCustomEvent>();
  const { journey } = useJourneyStore<TContext, TStepId, TCustomEvent>();

  const StepComponent = journey.steps[snapshot.current]?.component;

  if (!StepComponent) {
    return <>{fallback}</>;
  }

  return <StepComponent />;
};
