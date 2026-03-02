import {
  defineComponent,
  provide,
  shallowRef,
  toRaw,
  watchEffect,
  type InjectionKey,
  type PropType,
  type ShallowRef
} from "vue";

import { createJourneyMachine } from "@rxova/journey-core";
import type {
  JourneyBindingsProviderProps,
  JourneyStoreValue,
  JourneyVueDefinition,
  JourneyVueEventPayloadMap
} from "../types";

type ProviderFactoryProps<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyVueEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
> = {
  JourneyContextKey: InjectionKey<
    ShallowRef<JourneyStoreValue<
      TContext,
      TStepId,
      TCustomEvent,
      TEventPayloadMap,
      TStepMeta
    > | null>
  >;
  boundJourney: JourneyVueDefinition<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>;
};

export const createProvider = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyVueEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
>({
  JourneyContextKey,
  boundJourney
}: ProviderFactoryProps<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>) => {
  type ProviderProps = JourneyBindingsProviderProps<
    TContext,
    TStepId,
    TCustomEvent,
    TEventPayloadMap,
    TStepMeta
  >;
  type Store = JourneyStoreValue<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>;

  const Provider = defineComponent({
    name: "JourneyBindingsProvider",
    props: {
      journey: Object as PropType<ProviderProps["journey"]>,
      machine: Object as PropType<ProviderProps["machine"]>,
      persistence: Object as PropType<ProviderProps["persistence"]>,
      resetOnJourneyChange: {
        type: Boolean,
        default: false
      }
    },
    setup(props, { slots }) {
      const internalMachineRef = shallowRef<Store["machine"] | null>(null);
      const initialJourney = (props.journey ?? boundJourney) as JourneyVueDefinition<
        TContext,
        TStepId,
        TCustomEvent,
        TEventPayloadMap,
        TStepMeta
      >;
      const journeyRef = shallowRef(initialJourney);
      const persistenceRef = shallowRef(props.persistence);
      const storeRef = shallowRef<Store | null>(null);

      provide(JourneyContextKey, storeRef);

      watchEffect(() => {
        const incomingJourney = toRaw(
          (props.journey ?? boundJourney) as ProviderProps["journey"]
        ) as JourneyVueDefinition<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>;
        const incomingMachine = props.machine ? toRaw(props.machine) : undefined;
        const shouldResetInternal =
          props.resetOnJourneyChange && journeyRef.value !== incomingJourney;
        const shouldResetPersistence = persistenceRef.value !== props.persistence;

        if (
          !incomingMachine &&
          (!internalMachineRef.value || shouldResetInternal || shouldResetPersistence)
        ) {
          const options = props.persistence ? { persistence: props.persistence } : undefined;
          internalMachineRef.value = createJourneyMachine(incomingJourney, options);
          journeyRef.value = incomingJourney;
          persistenceRef.value = props.persistence;
        }

        const resolvedMachine = incomingMachine ?? internalMachineRef.value;
        if (!resolvedMachine) {
          throw new Error("bindings.Provider could not resolve a machine instance.");
        }

        const resolvedJourney = incomingMachine ? incomingJourney : journeyRef.value;
        storeRef.value = {
          machine: resolvedMachine,
          journey: resolvedJourney
        };
      });

      return () => slots.default?.() ?? null;
    }
  });

  return Provider;
};
