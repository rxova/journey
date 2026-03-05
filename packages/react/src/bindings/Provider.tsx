import React from "react";

import { createJourneyMachine } from "@rxova/journey-core";
import type {
  JourneyBindingsProviderProps,
  JourneyReactDefinition,
  JourneyReactEventPayloadMap,
  JourneyStoreValue
} from "../types";

type ProviderFactoryProps<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
> = {
  JourneyContext: React.Context<JourneyStoreValue<
    TContext,
    TStepId,
    TCustomEvent,
    TEventPayloadMap,
    TStepMeta
  > | null>;
  boundJourney: JourneyReactDefinition<
    TContext,
    TStepId,
    TCustomEvent,
    TEventPayloadMap,
    TStepMeta
  >;
};

export const createProvider = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
>({
  JourneyContext,
  boundJourney
}: ProviderFactoryProps<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>) => {
  const Provider = ({
    journey,
    machine,
    persistence,
    resetOnJourneyChange = false,
    children
  }: JourneyBindingsProviderProps<
    TContext,
    TStepId,
    TCustomEvent,
    TEventPayloadMap,
    TStepMeta
  >) => {
    const incomingJourney = journey ?? boundJourney;
    const internalMachineRef = React.useRef<
      | JourneyStoreValue<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>["machine"]
      | null
    >(null);
    const journeyRef = React.useRef(incomingJourney);
    const persistenceRef = React.useRef(persistence);

    const shouldResetInternal = resetOnJourneyChange && journeyRef.current !== incomingJourney;
    const shouldResetPersistence = persistenceRef.current !== persistence;

    if (
      !machine &&
      (!internalMachineRef.current || shouldResetInternal || shouldResetPersistence)
    ) {
      const options = persistence ? { persistence } : undefined;
      internalMachineRef.current = createJourneyMachine(incomingJourney, options);
      journeyRef.current = incomingJourney;
      persistenceRef.current = persistence;
    }

    const resolvedMachine = machine ?? internalMachineRef.current!;
    const resolvedJourney = machine ? incomingJourney : journeyRef.current;
    const value = React.useMemo<
      JourneyStoreValue<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>
    >(
      () => ({
        machine: resolvedMachine,
        journey: resolvedJourney
      }),
      [resolvedMachine, resolvedJourney]
    );

    return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
  };

  return Provider;
};
