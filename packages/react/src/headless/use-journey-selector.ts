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

  // The subscription is deliberately selector-independent: inline selectors
  // (the common case) would otherwise tear it down on every render. It fires
  // on every snapshot publish; `getSelectedSnapshot`'s cache returns a stable
  // reference when the selected value is unchanged, so useSyncExternalStore
  // still skips the re-render.
  const subscribe = React.useCallback(
    (onStoreChange: () => void) =>
      machine.subscriptions.subscribeSelector(
        (snapshot) => snapshot,
        () => onStoreChange()
      ),
    [machine]
  );

  return React.useSyncExternalStore(subscribe, getSelectedSnapshot, getSelectedSnapshot);
};
