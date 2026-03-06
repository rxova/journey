import React from "react";

import type { JourneyObservationEvent } from "@rxova/journey-core";
import type { JourneyEventType, JourneyReactEventPayloadMap, JourneyStoreValue } from "../types";

type UseJourneyStore<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
> = (
  hookName?: string
) => JourneyStoreValue<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>;

export const createUseJourneyEvent = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
>(
  useJourneyStore: UseJourneyStore<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>
) => {
  return (
    listener: (
      event: JourneyObservationEvent<
        TStepId,
        JourneyEventType<TCustomEvent>,
        TEventPayloadMap,
        TStepMeta
      >
    ) => void
  ) => {
    const { machine } = useJourneyStore("useJourneyEvent");
    const listenerRef = React.useRef(listener);
    listenerRef.current = listener;

    React.useEffect(() => {
      return machine.subscribeEvent((event) => {
        listenerRef.current(event);
      });
    }, [machine]);
  };
};
