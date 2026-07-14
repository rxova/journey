import React from "react";
import type { AnyJourneyMachine, SnapshotOf } from "./headless.types";

type SelectorCacheEntry<TMachine, TSelected> = {
  machine: TMachine;
  snapshot: unknown;
  selected: TSelected;
  selector: unknown;
  isEqual: unknown;
};

/**
 * Subscribes to a derived slice of a machine's snapshot; the component only
 * re-renders when the selected value changes (per `equalityFn`, default
 * `Object.is`).
 */
export const useJourneySelector = <TMachine extends AnyJourneyMachine, TSelected>(
  machine: TMachine,
  selector: (snapshot: SnapshotOf<TMachine>) => TSelected,
  equalityFn?: (a: TSelected, b: TSelected) => boolean
): TSelected => {
  const isEqual = equalityFn ?? Object.is;
  const cacheRef = React.useRef<SelectorCacheEntry<TMachine, TSelected> | null>(null);

  const getSelectedSnapshot = React.useCallback(() => {
    const nextSnapshot = machine.getSnapshot();
    const cached = cacheRef.current;

    if (
      cached &&
      Object.is(cached.machine, machine) &&
      Object.is(cached.selector, selector) &&
      Object.is(cached.isEqual, isEqual) &&
      Object.is(cached.snapshot, nextSnapshot)
    ) {
      return cached.selected;
    }

    const nextSelected = selector(nextSnapshot as SnapshotOf<TMachine>);

    if (
      cached &&
      Object.is(cached.machine, machine) &&
      Object.is(cached.selector, selector) &&
      Object.is(cached.isEqual, isEqual) &&
      isEqual(cached.selected, nextSelected)
    ) {
      cacheRef.current = {
        machine,
        snapshot: nextSnapshot,
        selected: cached.selected,
        selector,
        isEqual
      };
      return cached.selected;
    }

    cacheRef.current = {
      machine,
      snapshot: nextSnapshot,
      selected: nextSelected,
      selector,
      isEqual
    };
    return nextSelected;
  }, [machine, isEqual, selector]);

  const subscribeToSelectedSnapshot = React.useCallback(
    (onStoreChange: () => void) =>
      machine.subscriptions.subscribeSelector(
        selector as (snapshot: unknown) => unknown,
        () => onStoreChange(),
        isEqual as (a: unknown, b: unknown) => boolean
      ),
    [machine, isEqual, selector]
  );

  return React.useSyncExternalStore(
    subscribeToSelectedSnapshot,
    getSelectedSnapshot,
    getSelectedSnapshot
  );
};
