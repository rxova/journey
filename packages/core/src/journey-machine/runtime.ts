import { errorInDevelopment, stabilizeSnapshot, warnInDevelopment } from "./helpers";

import type {
  JourneyEqualityFn,
  JourneyJsonObject,
  JourneyMachineSnapshotReason,
  JourneyObservationEvent,
  JourneySelector,
  JourneySnapshot
} from "../types";

type SnapshotOptions = {
  notify?: boolean;
  reason?: JourneyMachineSnapshotReason;
};

export type JourneyMachineRuntime<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>
> = {
  getSnapshot: () => JourneySnapshot<TContext, TStepId>;
  peekSnapshot: () => JourneySnapshot<TContext, TStepId>;
  setSnapshot: (
    nextSnapshot: JourneySnapshot<TContext, TStepId>,
    options?: SnapshotOptions
  ) => JourneySnapshot<TContext, TStepId>;
  isDisposed: () => boolean;
  isRunActive: (runVersion: number) => boolean;
  cancelInFlight: () => void;
  openLifecycle: (runVersion: number) => AbortController | null;
  closeLifecycle: (controller: AbortController) => void;
  queue: <T>(
    runner: (runVersion: number, signal: AbortSignal) => Promise<T>,
    onCanceled: () => T
  ) => Promise<T>;
  notify: () => void;
  emit: (event: JourneyObservationEvent<TStepId, TEventMap>) => void;
  subscribe: (listener: () => void) => () => void;
  subscribeSelector: <TSelected>(
    selector: JourneySelector<TContext, TStepId, TSelected>,
    listener: (next: TSelected, previous: TSelected) => void,
    equalityFn?: JourneyEqualityFn<TSelected>
  ) => () => void;
  subscribeEvent: (
    listener: (event: JourneyObservationEvent<TStepId, TEventMap>) => void
  ) => () => void;
  dispose: () => void;
};

export const createJourneyMachineRuntime = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>
>({
  snapshot: initialSnapshot,
  onSnapshotChange,
  onDispose,
  onListenerError
}: {
  snapshot: JourneySnapshot<TContext, TStepId>;
  onSnapshotChange?: (args: {
    previousSnapshot: JourneySnapshot<TContext, TStepId>;
    snapshot: JourneySnapshot<TContext, TStepId>;
    reason: JourneyMachineSnapshotReason;
  }) => void;
  onDispose?: () => void;
  onListenerError?: (error: unknown, context: "snapshot" | "event") => void;
}): JourneyMachineRuntime<TContext, TStepId, TEventMap> => {
  let snapshot = stabilizeSnapshot(initialSnapshot);
  let exposedSnapshot = stabilizeSnapshot(snapshot);
  const listeners = new Set<() => void>();
  const eventListeners = new Set<(event: JourneyObservationEvent<TStepId, TEventMap>) => void>();
  let actionQueue: Promise<void> = Promise.resolve();
  let lifecycleVersion = 0;
  let isDisposed = false;
  let activeAbortController: AbortController | null = null;
  const lifecycleAbortControllers = new Set<AbortController>();
  const reportListenerError =
    onListenerError ??
    ((error: unknown, context: "snapshot" | "event") => {
      errorInDevelopment(`Journey ${context} listener threw an error.`, error);
    });

  const notify = () => {
    for (const listener of listeners) {
      try {
        listener();
      } catch (error) {
        // Individual listener failure must not block other listeners.
        reportListenerError(error, "snapshot");
      }
    }
  };

  const emit = (event: JourneyObservationEvent<TStepId, TEventMap>) => {
    for (const listener of eventListeners) {
      try {
        listener(event);
      } catch (error) {
        // Individual listener failure must not block other listeners.
        reportListenerError(error, "event");
      }
    }
  };

  const setSnapshot = (
    nextSnapshot: JourneySnapshot<TContext, TStepId>,
    options: SnapshotOptions = {}
  ) => {
    const previousExposedSnapshot = exposedSnapshot;
    const stableSnapshot = stabilizeSnapshot(nextSnapshot);
    const nextExposedSnapshot = stabilizeSnapshot(stableSnapshot);
    onSnapshotChange?.({
      previousSnapshot: stabilizeSnapshot(previousExposedSnapshot),
      snapshot: stabilizeSnapshot(nextExposedSnapshot),
      reason: options.reason ?? "transition"
    });
    snapshot = stableSnapshot;
    exposedSnapshot = nextExposedSnapshot;
    if (options.notify) {
      notify();
    }
    return nextExposedSnapshot;
  };

  const isRunActive = (runVersion: number): boolean =>
    !isDisposed && runVersion === lifecycleVersion;

  const cancelInFlight = () => {
    lifecycleVersion += 1;
    if (activeAbortController && !activeAbortController.signal.aborted) {
      activeAbortController.abort();
    }
    activeAbortController = null;
    for (const controller of lifecycleAbortControllers) {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    }
    lifecycleAbortControllers.clear();
    actionQueue = Promise.resolve();
  };

  const openLifecycle = (runVersion: number): AbortController | null => {
    if (!isRunActive(runVersion)) {
      return null;
    }

    const controller = new AbortController();
    if (!isRunActive(runVersion)) {
      controller.abort();
      return null;
    }

    lifecycleAbortControllers.add(controller);
    return controller;
  };

  const closeLifecycle = (controller: AbortController) => {
    lifecycleAbortControllers.delete(controller);
  };

  const queue = <T>(
    runner: (runVersion: number, signal: AbortSignal) => Promise<T>,
    onCanceled: () => T
  ): Promise<T> => {
    const runVersion = lifecycleVersion;
    const createQueuedRunner = async () => {
      if (!isRunActive(runVersion)) {
        return onCanceled();
      }
      const abortController = new AbortController();
      activeAbortController = abortController;

      try {
        if (!isRunActive(runVersion)) {
          abortController.abort();
          return onCanceled();
        }

        return await runner(runVersion, abortController.signal);
      } finally {
        if (activeAbortController === abortController) {
          activeAbortController = null;
        }
      }
    };

    const resultPromise = actionQueue.then(createQueuedRunner, createQueuedRunner);
    // Both handlers map to `undefined` intentionally: a failed operation must
    // not block subsequent queued operations — each entry runs independently.
    actionQueue = resultPromise.then(
      () => undefined,
      () => undefined
    );
    return resultPromise;
  };

  const subscribe = (listener: () => void) => {
    if (isDisposed) {
      warnInDevelopment('Journey machine has been disposed; "subscribe" is a no-op.');
      return () => undefined;
    }

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const subscribeSelector = <TSelected>(
    selector: JourneySelector<TContext, TStepId, TSelected>,
    listener: (next: TSelected, previous: TSelected) => void,
    equalityFn?: JourneyEqualityFn<TSelected>
  ) => {
    if (isDisposed) {
      warnInDevelopment('Journey machine has been disposed; "subscribeSelector" is a no-op.');
      return () => undefined;
    }

    const isEqual = equalityFn ?? Object.is;
    let selected = selector(exposedSnapshot);

    return subscribe(() => {
      const nextSelected = selector(exposedSnapshot);
      if (isEqual(selected, nextSelected)) {
        return;
      }

      const previous = selected;
      selected = nextSelected;
      listener(nextSelected, previous);
    });
  };

  const subscribeEvent = (
    listener: (event: JourneyObservationEvent<TStepId, TEventMap>) => void
  ) => {
    if (isDisposed) {
      warnInDevelopment('Journey machine has been disposed; "subscribeEvent" is a no-op.');
      return () => undefined;
    }

    eventListeners.add(listener);
    return () => {
      eventListeners.delete(listener);
    };
  };

  const dispose = () => {
    if (isDisposed) {
      return;
    }

    isDisposed = true;
    cancelInFlight();
    listeners.clear();
    eventListeners.clear();
    onDispose?.();
  };

  return {
    getSnapshot: () => exposedSnapshot,
    peekSnapshot: () => snapshot,
    setSnapshot,
    isDisposed: () => isDisposed,
    isRunActive,
    cancelInFlight,
    openLifecycle,
    closeLifecycle,
    queue,
    notify,
    emit,
    subscribe,
    subscribeSelector,
    subscribeEvent,
    dispose
  };
};
