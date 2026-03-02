import { inject, type InjectionKey, type ShallowRef } from "vue";

import type {
  JourneyBindings,
  JourneyStoreValue,
  JourneyVueDefinition,
  JourneyVueEventPayloadMap
} from "../types";
import { createProvider } from "./Provider";
import { createStepRenderer } from "./StepRenderer";
import { createUseJourneyApi } from "./useJourneyApi";
import { createUseJourneyMachine } from "./useJourneyMachine";
import { createUseJourneySnapshot } from "./useJourneySnapshot";

export const createJourneyBindings = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyVueEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
>(
  boundJourney: JourneyVueDefinition<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>
): JourneyBindings<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta> => {
  type Store = JourneyStoreValue<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>;

  const JourneyContextKey = Symbol("JourneyContext") as InjectionKey<ShallowRef<Store | null>>;

  const useJourneyStoreRef = (hookName = "hook") => {
    const storeRef = inject(JourneyContextKey);
    if (!storeRef) {
      throw new Error(`${hookName} must be used within bindings.Provider.`);
    }

    return storeRef;
  };

  const useJourneyStore = (hookName = "hook") => {
    const storeRef = useJourneyStoreRef(hookName);

    const readStore = () => {
      if (!storeRef.value) {
        throw new Error(`${hookName} must be used within bindings.Provider.`);
      }
      return storeRef.value;
    };

    return {
      get machine() {
        return readStore().machine;
      },
      get journey() {
        return readStore().journey;
      }
    } as Store;
  };

  const useJourneySnapshot = createUseJourneySnapshot(useJourneyStoreRef);
  const useJourneyMachine = createUseJourneyMachine(useJourneyStore);
  const useJourneyApi = createUseJourneyApi(useJourneyStore);

  const Provider = createProvider({
    JourneyContextKey,
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
