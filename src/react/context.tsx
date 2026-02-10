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
  children
}: JourneyProviderProps<TContext, TStepId, TCustomEvent, TEventPayloadMap>) => {
  const resolvedMachine = React.useMemo(
    () => machine ?? createJourneyMachine(journey, persistence ? { persistence } : undefined),
    [journey, machine, persistence]
  );

  return (
    <JourneyContext.Provider
      value={
        {
          machine: resolvedMachine,
          journey
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
