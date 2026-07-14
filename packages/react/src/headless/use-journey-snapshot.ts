import React from "react";
import type { AnyJourneyMachine, SnapshotOf } from "./headless.types";

/** Subscribes to a machine and returns its current snapshot. */
export const useJourneySnapshot = <TMachine extends AnyJourneyMachine>(
  machine: TMachine
): SnapshotOf<TMachine> => {
  const getSnapshot = React.useCallback(
    () => machine.getSnapshot() as SnapshotOf<TMachine>,
    [machine]
  );
  const subscribe = React.useCallback(
    (onStoreChange: () => void) =>
      machine.subscriptions.subscribeSelector(
        (snapshot) => snapshot,
        () => onStoreChange()
      ),
    [machine]
  );

  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
