import React from "react";

import type { JourneyEqualityFn, JourneySelector, JourneySnapshot } from "@rxova/journey-core";
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

type SelectorCache<TContext, TStepId extends string, TStepMeta, TSelected> = {
  snapshot: JourneySnapshot<TContext, TStepId, TStepMeta>;
  selected: TSelected;
  selector: JourneySelector<TContext, TStepId, TStepMeta, TSelected>;
  isEqual: JourneyEqualityFn<TSelected>;
};

export const createUseJourneySelector = <
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>,
  TStepMeta = unknown
>(
  useJourneyStore: UseJourneyStore<TContext, TStepId, TCustomEvent, TEventPayloadMap, TStepMeta>
) => {
  return <TSelected>(
    selector: JourneySelector<TContext, TStepId, TStepMeta, TSelected>,
    equalityFn?: JourneyEqualityFn<TSelected>
  ): TSelected => {
    const { machine } = useJourneyStore("useJourneySelector");
    const isEqual = equalityFn ?? Object.is;
    const cacheRef = React.useRef<SelectorCache<TContext, TStepId, TStepMeta, TSelected> | null>(
      null
    );

    const getSelectedSnapshot = React.useCallback(() => {
      const nextSnapshot = machine.getSnapshot();
      const cached = cacheRef.current;

      if (
        cached &&
        cached.selector === selector &&
        cached.isEqual === isEqual &&
        Object.is(cached.snapshot, nextSnapshot)
      ) {
        return cached.selected;
      }

      const nextSelected = selector(nextSnapshot);

      if (cached && cached.selector === selector && cached.isEqual === isEqual) {
        if (cached.isEqual(cached.selected, nextSelected)) {
          cacheRef.current = {
            snapshot: nextSnapshot,
            selected: cached.selected,
            selector,
            isEqual
          };
          return cached.selected;
        }
      }

      cacheRef.current = {
        snapshot: nextSnapshot,
        selected: nextSelected,
        selector,
        isEqual
      };
      return nextSelected;
    }, [machine, selector, isEqual]);

    const subscribeToSelectedSnapshot = React.useCallback(
      (onStoreChange: () => void) =>
        machine.subscribeSelector(
          selector,
          () => {
            onStoreChange();
          },
          isEqual
        ),
      [machine, selector, isEqual]
    );

    return React.useSyncExternalStore(
      subscribeToSelectedSnapshot,
      getSelectedSnapshot,
      getSelectedSnapshot
    );
  };
};
