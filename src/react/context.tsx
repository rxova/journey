import React from "react";

import { createJourneyMachine } from "@/src/core";
import type {
  JourneyProviderProps,
  JourneyReactEventPayloadMap,
  JourneyStoreValue
} from "@/src/react/types";

const JourneyContext = React.createContext<JourneyStoreValue<
  unknown,
  string,
  string,
  Record<never, never>
> | null>(null);

export const JourneyProvider = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>
>({
  journey,
  machine,
  persistence,
  resetOnJourneyChange = false,
  children
}: JourneyProviderProps<TContext, TStepId, TCustomEvent, TEventPayloadMap>) => {
  const internalMachineRef = React.useRef<
    JourneyStoreValue<TContext, TStepId, TCustomEvent, TEventPayloadMap>["machine"] | null
  >(null);
  const journeyRef = React.useRef(journey);
  const persistenceRef = React.useRef(persistence);

  const shouldResetInternal = resetOnJourneyChange && journeyRef.current !== journey;
  const shouldResetPersistence = persistenceRef.current !== persistence;

  if (!machine && (!internalMachineRef.current || shouldResetInternal || shouldResetPersistence)) {
    internalMachineRef.current = createJourneyMachine(
      journey,
      persistence ? { persistence } : undefined
    );
    journeyRef.current = journey;
    persistenceRef.current = persistence;
  }

  const resolvedMachine = machine ?? internalMachineRef.current!;
  const resolvedJourney = machine ? journey : journeyRef.current;

  return (
    <JourneyContext.Provider
      value={
        {
          machine: resolvedMachine,
          journey: resolvedJourney
        } as unknown as JourneyStoreValue<unknown, string, string>
      }
    >
      {children}
    </JourneyContext.Provider>
  );
};

export const useJourneyStore = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>
>(
  hookName = "useJourney"
): JourneyStoreValue<TContext, TStepId, TCustomEvent, TEventPayloadMap> => {
  const value = React.useContext(JourneyContext);
  if (!value) {
    throw new Error(`${hookName} must be used within <JourneyProvider>.`);
  }

  return value as unknown as JourneyStoreValue<TContext, TStepId, TCustomEvent, TEventPayloadMap>;
};
