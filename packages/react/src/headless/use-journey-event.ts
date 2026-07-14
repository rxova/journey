import React from "react";
import type { JourneyEventPayloads, JourneySubscriptionEvent } from "@rxova/journey-core";
import type { AnyJourneyMachine, ContextOf, SnapshotOf, StepIdOf } from "./headless.types";

const useSafeLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/** The payload a machine delivers for one of its subscription events. */
export type EventPayloadOf<
  TMachine,
  TEvent extends JourneySubscriptionEvent
> = JourneyEventPayloads<ContextOf<TMachine>, StepIdOf<TMachine>, SnapshotOf<TMachine>>[TEvent];

/**
 * Subscribes `listener` to one of the machine's subscription events for the
 * component's lifetime. The listener reference may change freely between
 * renders without resubscribing.
 */
export const useJourneyEvent = <
  TMachine extends AnyJourneyMachine,
  TEvent extends JourneySubscriptionEvent
>(
  machine: TMachine,
  event: TEvent,
  listener: (payload: EventPayloadOf<TMachine, TEvent>) => void
): void => {
  const listenerRef = React.useRef(listener);
  listenerRef.current = listener;

  useSafeLayoutEffect(() => {
    return machine.subscriptions.subscribeEvent(event, (payload) => {
      listenerRef.current(payload as EventPayloadOf<TMachine, TEvent>);
    });
  }, [machine, event]);
};
