import React from "react";

import type {
  JourneyComputed,
  JourneyEqualityFn,
  JourneyJsonObject,
  JourneyObservationEvent,
  JourneySnapshot,
  JourneyStepAsyncState
} from "@rxova/journey-core";

const useSafeLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

const IDLE_STEP_ASYNC_STATE: JourneyStepAsyncState = {
  phase: "idle",
  eventType: null,
  transitionId: null,
  error: null
};

const isSameStepAsyncState = (a: JourneyStepAsyncState, b: JourneyStepAsyncState): boolean =>
  a.phase === b.phase &&
  a.eventType === b.eventType &&
  a.transitionId === b.transitionId &&
  Object.is(a.error, b.error);

/**
 * The structural machine surface the headless hooks require. Every core
 * `create*Journey` result satisfies it; the hooks infer their concrete
 * snapshot/step/event types from the machine you pass, so a store-held,
 * prop-passed, or `useOwnedJourney`-owned machine all type identically.
 */
export type AnyJourneyMachine = {
  // Method syntax (not arrow-property syntax) is deliberate: method signatures
  // compare parameters bivariantly, so concretely-typed machines satisfy this
  // structural surface without variance gymnastics.
  getSnapshot(): JourneySnapshot<JourneyJsonObject, string>;
  getComputed(): JourneyComputed<string>;
  subscribe(listener: () => void): () => void;
  subscribeSelector(
    selector: (snapshot: JourneySnapshot<JourneyJsonObject, string>) => unknown,
    listener: (next: unknown, previous: unknown) => void,
    equalityFn?: (previous: unknown, next: unknown) => boolean
  ): () => void;
  subscribeEvent(
    listener: (event: JourneyObservationEvent<string, { type: string }>) => void
  ): () => void;
};

/** The exact snapshot type a machine emits. */
export type SnapshotOf<TMachine> = TMachine extends {
  getSnapshot: () => infer TSnapshot;
}
  ? TSnapshot
  : never;

/** The exact computed type a machine derives. */
export type ComputedOf<TMachine> = TMachine extends {
  getComputed: () => infer TComputed;
}
  ? TComputed
  : never;

/** The step-id union of a machine, inferred from its snapshot. */
export type StepIdOf<TMachine> =
  SnapshotOf<TMachine> extends { currentStepId: infer TStepId extends string } ? TStepId : never;

/** The context type of a machine, inferred from its snapshot. */
export type ContextOf<TMachine> =
  SnapshotOf<TMachine> extends { context: infer TContext } ? TContext : never;

/** The observation-event union a machine emits. */
export type ObservationEventOf<TMachine> = TMachine extends {
  subscribeEvent: (listener: (event: infer TEvent) => void) => () => void;
}
  ? TEvent
  : never;

type SelectorCacheEntry<TMachine, TSelected> = {
  machine: TMachine;
  snapshot: unknown;
  selected: TSelected;
  selector: unknown;
  isEqual: unknown;
};

/** Subscribes to a machine and returns its current snapshot. */
export const useJourneySnapshot = <TMachine extends AnyJourneyMachine>(
  machine: TMachine
): SnapshotOf<TMachine> => {
  const getSnapshot = React.useCallback(
    () => machine.getSnapshot() as SnapshotOf<TMachine>,
    [machine]
  );
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => machine.subscribe(onStoreChange),
    [machine]
  );

  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

/** Subscribes to a machine and returns its mode-aware computed state. */
export const useJourneyComputed = <TMachine extends AnyJourneyMachine>(
  machine: TMachine
): ComputedOf<TMachine> => {
  const snapshot = useJourneySnapshot(machine);
  return React.useMemo(() => {
    void snapshot;
    return machine.getComputed() as ComputedOf<TMachine>;
  }, [machine, snapshot]);
};

/**
 * Subscribes to a derived slice of a machine's snapshot; the component only
 * re-renders when the selected value changes (per `equalityFn`, default
 * `Object.is`).
 */
export const useJourneySelector = <TMachine extends AnyJourneyMachine, TSelected>(
  machine: TMachine,
  selector: (snapshot: SnapshotOf<TMachine>) => TSelected,
  equalityFn?: JourneyEqualityFn<TSelected>
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
      machine.subscribeSelector(
        selector as never,
        () => {
          onStoreChange();
        },
        isEqual as never
      ),
    [machine, isEqual, selector]
  );

  return React.useSyncExternalStore(
    subscribeToSelectedSnapshot,
    getSelectedSnapshot,
    getSelectedSnapshot
  );
};

/**
 * Subscribes `listener` to the machine's observation-event stream for the
 * component's lifetime. The listener reference may change freely between
 * renders without resubscribing.
 */
export const useJourneyEvent = <TMachine extends AnyJourneyMachine>(
  machine: TMachine,
  listener: (event: ObservationEventOf<TMachine>) => void
): void => {
  const listenerRef = React.useRef(listener);
  listenerRef.current = listener;

  useSafeLayoutEffect(() => {
    return machine.subscribeEvent((event) => {
      listenerRef.current(event as ObservationEventOf<TMachine>);
    });
  }, [machine]);
};

/** Runs callbacks when the machine enters or leaves the given step. */
export const useJourneyStepLifecycle = <TMachine extends AnyJourneyMachine>(
  machine: TMachine,
  stepId: StepIdOf<TMachine>,
  callbacks: {
    onEnter?: (args: { context: ContextOf<TMachine> }) => void;
    onLeave?: (args: { context: ContextOf<TMachine> }) => void;
  }
): void => {
  useJourneyEvent(machine, (event) => {
    const observed = event as { type: string; stepId?: string };
    if (observed.type === "step.enter" && observed.stepId === stepId) {
      callbacks.onEnter?.({ context: machine.getSnapshot().context as ContextOf<TMachine> });
    } else if (observed.type === "step.exit" && observed.stepId === stepId) {
      callbacks.onLeave?.({ context: machine.getSnapshot().context as ContextOf<TMachine> });
    }
  });
};

/** Subscribes to a single step's async execution state. */
export const useStepAsyncState = <TMachine extends AnyJourneyMachine>(
  machine: TMachine,
  stepId: StepIdOf<TMachine>
): JourneyStepAsyncState =>
  useJourneySelector(
    machine,
    (snapshot) =>
      (snapshot as JourneySnapshot<JourneyJsonObject, string>).async.byStep[stepId] ??
      IDLE_STEP_ASYNC_STATE,
    isSameStepAsyncState
  );
