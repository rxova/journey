import React from "react";
import type { AnyJourneyMachine, SnapshotOf } from "./headless.types";

/**
 * Subscribes to a machine and returns its current snapshot. Thin shell over
 * `useSyncExternalStore`: `machine.getSnapshot` is a stable per-machine bound
 * function, so only the subscribe adapter needs memoizing (core has no plain
 * `subscribe` — an identity `subscribeSelector` is that signal).
 */
export const useJourneySnapshot = <TMachine extends AnyJourneyMachine>(
  machine: TMachine
): SnapshotOf<TMachine> => {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) =>
      machine.subscriptions.subscribeSelector((snapshot) => snapshot, onStoreChange),
    [machine]
  );

  return React.useSyncExternalStore(
    subscribe,
    machine.getSnapshot,
    machine.getSnapshot
  ) as SnapshotOf<TMachine>;
};
