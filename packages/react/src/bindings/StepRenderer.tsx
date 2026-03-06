import React from "react";

import type { JourneySnapshot } from "@rxova/journey-core";
import type { JourneyReactEventPayloadMap, JourneyStoreValue } from "../types";

type UseJourneyStore<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
> = (
  hookName?: string
) => JourneyStoreValue<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>;

type UseJourneySnapshot<
  TContext,
  TStepId extends string,
  TStepMeta = unknown
> = () => JourneySnapshot<TContext, TStepId, TStepMeta>;

type StepRendererFactoryProps<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
> = {
  useJourneySnapshot: UseJourneySnapshot<TContext, TStepId, TStepMeta>;
  useJourneyStore: UseJourneyStore<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>;
};

export const createStepRenderer = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
>({
  useJourneySnapshot,
  useJourneyStore
}: StepRendererFactoryProps<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>) => {
  const StepRenderer = ({ fallback = null }: { fallback?: React.ReactNode }) => {
    const snapshot = useJourneySnapshot();
    const { journey } = useJourneyStore("StepRenderer");

    const StepComponent = journey.steps[snapshot.currentStepId]?.component;

    if (!StepComponent) {
      return <>{fallback}</>;
    }

    return <StepComponent key={snapshot.currentStepId} />;
  };

  return StepRenderer;
};
