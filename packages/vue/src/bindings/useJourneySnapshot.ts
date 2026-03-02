import { shallowRef, watch, type ShallowRef } from "vue";

import type { JourneySnapshot } from "@rxova/journey-core";
import type { JourneyStoreValue, JourneyVueEventPayloadMap } from "../types";

type UseJourneyStoreRef<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyVueEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
> = (
  hookName?: string
) => ShallowRef<JourneyStoreValue<
  TContext,
  TStepId,
  TCustomEvent,
  TEventPayloadMap,
  TStepMeta
> | null>;

export const createUseJourneySnapshot = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyVueEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
>(
  useJourneyStoreRef: UseJourneyStoreRef<
    TContext,
    TStepId,
    TCustomEvent,
    TEventPayloadMap,
    TStepMeta
  >
) => {
  return (): ShallowRef<JourneySnapshot<TContext, TStepId, TStepMeta>> => {
    const storeRef = useJourneyStoreRef("useJourneySnapshot");
    if (!storeRef.value) {
      throw new Error("useJourneySnapshot must be used within bindings.Provider.");
    }

    const snapshot = shallowRef(storeRef.value.machine.getSnapshot()) as ShallowRef<
      JourneySnapshot<TContext, TStepId, TStepMeta>
    >;

    watch(
      () => storeRef.value?.machine,
      (machine, _previousMachine, onCleanup) => {
        if (!machine) {
          return;
        }

        snapshot.value = machine.getSnapshot();

        const unsubscribe = machine.subscribe(() => {
          snapshot.value = machine.getSnapshot();
        });

        onCleanup(unsubscribe);
      },
      { immediate: true }
    );

    return snapshot;
  };
};
