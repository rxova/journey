import React from "react";

import type {
  JourneyBindings,
  JourneyReactDefinition,
  JourneyReactEventPayloadMap,
  JourneyStoreValue
} from "../types";
import { createProvider } from "./Provider";
import { createStepRenderer } from "./StepRenderer";
import { createUseJourneyApi } from "./useJourneyApi";
import { createUseJourneyMachine } from "./useJourneyMachine";
import { createUseJourneySnapshot } from "./useJourneySnapshot";

/**
 * Creates a typed React integration bundle (Provider, StepRenderer, and hooks)
 * bound to a specific journey definition.
 */
export const createJourneyBindings = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
>(
  boundJourney: JourneyReactDefinition<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>
): JourneyBindings<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta> => {
  const JourneyContext = React.createContext<JourneyStoreValue<
    TContext,
    TStepId,
    TCustomEvent,
    TEventPayloadMap,
    TStepMeta
  > | null>(null);

  const useJourneyStore = (hookName = "hook") => {
    const value = React.useContext(JourneyContext);
    if (!value) {
      throw new Error(`${hookName} must be used within bindings.Provider.`);
    }
    return value;
  };

  const useJourneySnapshot = createUseJourneySnapshot(useJourneyStore);
  const useJourneyMachine = createUseJourneyMachine(useJourneyStore);
  const useJourneyApi = createUseJourneyApi(useJourneyStore);

  const Provider = createProvider({
    JourneyContext,
    boundJourney
  });

  const StepRenderer = createStepRenderer({
    useJourneySnapshot,
    useJourneyStore
  });

  return {
    Provider,
    StepRenderer,
    useJourneyApi,
    useJourneyMachine,
    useJourneySnapshot
  };
};
