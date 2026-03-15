import type {
  JourneyEqualityFn,
  JourneyEventPayloadMap,
  JourneyObservationEvent,
  JourneySelector,
  JourneySnapshot
} from "../types";

type SnapshotOptions = {
  persist?: boolean;
  clearPersisted?: boolean;
  notify?: boolean;
};

export type MachineRuntime<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>,
  TStepMeta
> = {
  getSnapshot: () => JourneySnapshot<TContext, TStepId, TStepMeta>;
  setSnapshot: (
    nextSnapshot: JourneySnapshot<TContext, TStepId, TStepMeta>,
    options?: SnapshotOptions
  ) => JourneySnapshot<TContext, TStepId, TStepMeta>;
  isDisposed: () => boolean;
  isRunActive: (runVersion: number) => boolean;
  cancelInFlight: () => void;
  queue: <T>(runner: (runVersion: number) => Promise<T>, onCanceled: () => T) => Promise<T>;
  notify: () => void;
  emit: (event: JourneyObservationEvent<TStepId, TEventType, TPayloadMap, TStepMeta>) => void;
  subscribe: (listener: () => void) => () => void;
  subscribeSelector: <TSelected>(
    selector: JourneySelector<TContext, TStepId, TStepMeta, TSelected>,
    listener: (next: TSelected, previous: TSelected) => void,
    equalityFn?: JourneyEqualityFn<TSelected>
  ) => () => void;
  subscribeEvent: (
    listener: (event: JourneyObservationEvent<TStepId, TEventType, TPayloadMap, TStepMeta>) => void
  ) => () => void;
  dispose: () => void;
};

export const createMachineRuntime = <
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>,
  TStepMeta
>({
  snapshot: initialSnapshot,
  startupEvent,
  persistSnapshot,
  removePersistedSnapshot
}: {
  snapshot: JourneySnapshot<TContext, TStepId, TStepMeta>;
  startupEvent: JourneyObservationEvent<TStepId, TEventType, TPayloadMap, TStepMeta>;
  persistSnapshot: (snapshot: JourneySnapshot<TContext, TStepId, TStepMeta>) => void;
  removePersistedSnapshot: () => void;
}): MachineRuntime<TContext, TStepId, TEventType, TPayloadMap, TStepMeta> => {
  let snapshot = initialSnapshot;
  const listeners = new Set<() => void>();
  const eventListeners = new Set<
    (event: JourneyObservationEvent<TStepId, TEventType, TPayloadMap, TStepMeta>) => void
  >();
  let actionQueue: Promise<void> = Promise.resolve();
  let lifecycleVersion = 0;
  let isDisposed = false;

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const emit = (event: JourneyObservationEvent<TStepId, TEventType, TPayloadMap, TStepMeta>) => {
    for (const listener of eventListeners) {
      listener(event);
    }
  };

  const setSnapshot = (
    nextSnapshot: JourneySnapshot<TContext, TStepId, TStepMeta>,
    options: SnapshotOptions = {}
  ) => {
    snapshot = nextSnapshot;
    if (options.persist) {
      persistSnapshot(snapshot);
    }
    if (options.clearPersisted) {
      removePersistedSnapshot();
    }
    if (options.notify) {
      notify();
    }
    return snapshot;
  };

  const isRunActive = (runVersion: number): boolean =>
    !isDisposed && runVersion === lifecycleVersion;

  const cancelInFlight = () => {
    lifecycleVersion += 1;
    actionQueue = Promise.resolve();
  };

  const queue = <T>(
    runner: (runVersion: number) => Promise<T>,
    onCanceled: () => T
  ): Promise<T> => {
    const runVersion = lifecycleVersion;
    const createQueuedRunner = async () => {
      if (!isRunActive(runVersion)) {
        return onCanceled();
      }
      return runner(runVersion);
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
      return () => undefined;
    }

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const subscribeSelector = <TSelected>(
    selector: JourneySelector<TContext, TStepId, TStepMeta, TSelected>,
    listener: (next: TSelected, previous: TSelected) => void,
    equalityFn?: JourneyEqualityFn<TSelected>
  ) => {
    if (isDisposed) {
      return () => undefined;
    }

    const isEqual = equalityFn ?? Object.is;
    let selected = selector(snapshot);

    return subscribe(() => {
      const nextSelected = selector(snapshot);
      if (isEqual(selected, nextSelected)) {
        return;
      }

      const previous = selected;
      selected = nextSelected;
      listener(nextSelected, previous);
    });
  };

  const subscribeEvent = (
    listener: (event: JourneyObservationEvent<TStepId, TEventType, TPayloadMap, TStepMeta>) => void
  ) => {
    if (isDisposed) {
      return () => undefined;
    }

    eventListeners.add(listener);
    try {
      listener(startupEvent);
    } catch (error) {
      eventListeners.delete(listener);
      throw error;
    }

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
  };

  return {
    getSnapshot: () => snapshot,
    setSnapshot,
    isDisposed: () => isDisposed,
    isRunActive,
    cancelInFlight,
    queue,
    notify,
    emit,
    subscribe,
    subscribeSelector,
    subscribeEvent,
    dispose
  };
};
