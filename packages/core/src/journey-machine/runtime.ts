import {
  errorInDevelopment,
  isInternalEventType,
  stabilizeSnapshot,
  warnInDevelopment
} from "./helpers";

import type {
  JourneyBaseEvent,
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

/**
 * True for `transition.*` observation events whose underlying event type is an
 * internal synthetic event (effect/after routing). These are filtered from the
 * observation stream; the real navigation (`step.enter`/`step.exit`) still fires.
 */
const isInternalTransitionObservation = (event: {
  type: string;
  event?: { type?: unknown };
  eventType?: unknown;
}): boolean => {
  if (event.type === "transition.start") {
    return typeof event.event?.type === "string" && isInternalEventType(event.event.type);
  }
  if (event.type === "transition.success" || event.type === "transition.error") {
    return typeof event.eventType === "string" && isInternalEventType(event.eventType);
  }
  return false;
};

export type JourneyMachineRuntime<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent
> = {
  getSnapshot: () => JourneySnapshot<TContext, TStepId>;
  peekSnapshot: () => JourneySnapshot<TContext, TStepId>;
  setSnapshot: (
    nextSnapshot: JourneySnapshot<TContext, TStepId>,
    options?: SnapshotOptions
  ) => JourneySnapshot<TContext, TStepId>;
  isDisposed: () => boolean;
  isRunActive: (runVersion: number) => boolean;
  getRunVersion: () => number;
  cancelInFlight: () => void;
  openLifecycle: (runVersion: number) => AbortController | null;
  closeLifecycle: (controller: AbortController) => void;
  queue: <T>(
    runner: (runVersion: number, signal: AbortSignal) => Promise<T>,
    onCanceled: () => T
  ) => Promise<T>;
  notify: () => void;
  emit: (event: JourneyObservationEvent<TStepId, TEvents>) => void;
  subscribe: (listener: () => void) => () => void;
  subscribeSelector: <TSelected>(
    selector: JourneySelector<TContext, TStepId, TSelected>,
    listener: (next: TSelected, previous: TSelected) => void,
    equalityFn?: JourneyEqualityFn<TSelected>
  ) => () => void;
  subscribeEvent: (
    listener: (event: JourneyObservationEvent<TStepId, TEvents>) => void
  ) => () => void;
  dispose: () => void;
};

export const createJourneyMachineRuntime = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent
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
}): JourneyMachineRuntime<TContext, TStepId, TEvents> => {
  let snapshot = stabilizeSnapshot(initialSnapshot);
  let exposedSnapshot = stabilizeSnapshot(snapshot);
  const listeners = new Set<() => void>();
  const eventListeners = new Set<(event: JourneyObservationEvent<TStepId, TEvents>) => void>();
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

  const emit = (event: JourneyObservationEvent<TStepId, TEvents>) => {
    // Effect routing and `after` timers drive transitions through internal
    // synthetic events. The resulting navigation (step.enter/exit) is real and
    // observable, but the synthetic transition.* notifications are an
    // implementation detail and must not surface to subscribers or plugins.
    if (isInternalTransitionObservation(event)) {
      return;
    }
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
    try {
      onSnapshotChange?.({
        previousSnapshot: stabilizeSnapshot(previousExposedSnapshot),
        snapshot: stabilizeSnapshot(nextExposedSnapshot),
        reason: options.reason ?? "transition"
      });
    } catch (error) {
      // A plugin's `onSnapshotChange` is a post-change observer (metrics,
      // persistence, replay); a throw must never abort the commit. Isolate it
      // like snapshot/event listeners so a misbehaving plugin can't block the
      // transition — report and continue.
      reportListenerError(error, "snapshot");
    }
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

  const subscribeEvent = (listener: (event: JourneyObservationEvent<TStepId, TEvents>) => void) => {
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
    getRunVersion: () => lifecycleVersion,
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
