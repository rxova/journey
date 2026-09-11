import React from "react";
import { createSelectorCache } from "./selector-cache";
import { useSafeLayoutEffect } from "./use-safe-layout-effect";
import type { JourneySubscriptionEvent } from "@rxova/journey-core";
import type {
  JourneyBundleBase,
  JourneyProviderProps,
  JourneyStepRendererProps,
  JourneyViews
} from "./react.types";

/**
 * The runtime surface the bindings drive. The factories hand us a concretely
 * typed machine; this is the one internal widening (mirroring the casts the
 * factories already perform on the core boundary).
 */
type BindableRuntime<TContext, TSnapshot> = {
  getSnapshot: () => TSnapshot;
  subscriptions: {
    subscribe: (listener: () => void) => () => void;
    subscribeEvent: (
      event: JourneySubscriptionEvent,
      listener: (payload: unknown) => void
    ) => () => void;
  };
  context: { update: (updater: (context: TContext) => TContext) => unknown };
  controls: { start: () => boolean };
};

// Hoisted selectors: stable identities let every built-in hook hit the
// same-snapshot fast path in useSelector's cache.
const selectSnapshot = <TSnapshot,>(snapshot: TSnapshot): TSnapshot => snapshot;
const selectStep = <TSnapshot extends { currentStep: unknown }>(
  snapshot: TSnapshot
): TSnapshot["currentStep"] => snapshot.currentStep;
const selectStepId = <TSnapshot extends { currentStep: { readonly id: string } | null }>(
  snapshot: TSnapshot
): string | undefined => snapshot.currentStep?.id;

/**
 * Builds the hook that starts the machine from a layout effect on first mount,
 * so every subscriber that mounted alongside it is attached before the initial
 * `stepEnter` fires — starting inside the factory makes that event structurally
 * unobservable. `controls.start()` no-ops unless the status is idle, so this
 * needs no ref counting and is safe under StrictMode's double effect.
 *
 * Every mounted entry point calls it: the Provider, every reactive hook, and
 * the tier verbs that register machine work.
 */
export const createAutoStartHook = (
  machine: { controls: { start: () => boolean } },
  startOnMount: boolean
): (() => void) => {
  // The effect is registered unconditionally — `startOnMount` is fixed for the
  // bundle's lifetime, but branching on it outside the hook would make the hook
  // count depend on a value read at build time, which is needlessly subtle.
  return () => {
    useSafeLayoutEffect(() => {
      if (startOnMount) machine.controls.start();
    }, []);
  };
};

/**
 * Builds the bundle surface both tiers share around one standalone machine:
 * the useSyncExternalStore bridge, the Provider/StepRenderer pair, and the
 * hooks that close over the machine. The factories spread this and add their
 * tier verbs (`send` for graph, `navigate` + `useStepHandler` for linear).
 * `displayBase` names the Provider/StepRenderer in DevTools and errors.
 */
export const createJourneyBindings = <
  TMachine extends { controls: unknown; navigate: unknown },
  TContext,
  TStepId extends string,
  TSnapshot extends { currentStep: { readonly id: TStepId } | null; context: TContext }
>(
  machine: TMachine,
  displayBase: string,
  useAutoStart: () => void
): JourneyBundleBase<TMachine, TContext, TStepId, TSnapshot> => {
  const runtime = machine as unknown as BindableRuntime<TContext, TSnapshot>;

  // Core's `subscribe` is a plain per-commit callback with no per-subscriber
  // work, so hooks subscribe to it directly — the multiplexer that used to sit
  // here existed only because core ran a selector and an equality check once
  // per subscriber on every publish.
  //
  // One closure per bundle, so the reference is stable and
  // useSyncExternalStore never resubscribes; it dispatches through
  // `runtime.subscriptions` at call time rather than capturing the method, so a
  // wrapper placed on the machine after the bundle is built still sees the
  // calls.
  const subscribe = (listener: () => void): (() => void) =>
    runtime.subscriptions.subscribe(listener);

  /**
   * The one React bridge in this bundle. useSyncExternalStore requires the
   * getter to return a STABLE reference while the selected value is unchanged
   * (an unstable object identity re-renders forever), and the machine
   * subscription must not churn with inline selectors.
   *
   * This mirrors React's own `useSyncExternalStoreWithSelector`: a per-
   * derivation cache built in `useMemo` handles the same-snapshot fast path,
   * and the last *committed* selection lives in a ref written from an effect.
   * Nothing is written during render — a render React starts and then discards
   * must not be able to poison the baseline that `equalityFn` compares against.
   */
  const useSelector = <TSelected,>(
    selector: (snapshot: TSnapshot) => TSelected,
    equalityFn?: (a: TSelected, b: TSelected) => boolean
  ): TSelected => {
    const committedRef = React.useRef<{ value: TSelected } | null>(null);

    // Rebuilt whenever the derivation changes. Inline selectors are fresh
    // closures every render, so this memo is often rebuilt — value identity is
    // preserved across those rebuilds by the committed ref, not by this cache.
    const getSelected = React.useMemo(() => {
      const select = createSelectorCache<TSnapshot, TSelected>(selector, equalityFn);
      return (): TSelected => select(runtime.getSnapshot(), committedRef.current);
    }, [selector, equalityFn]);

    const selected = React.useSyncExternalStore(subscribe, getSelected, getSelected);

    // The baseline advances only once a render commits.
    useSafeLayoutEffect(() => {
      committedRef.current = { value: selected };
    }, [selected]);
    // Declared last on purpose: layout effects fire in hook order, so the store
    // subscription above is live before the start effect can emit stepEnter.
    useAutoStart();
    return selected;
  };

  const ViewsContext = React.createContext<JourneyViews<TStepId> | null>(null);

  const Provider = ({ views, children }: JourneyProviderProps<TStepId>): React.ReactElement => {
    // Mounting the Provider starts the journey even when nothing under it is
    // reactive — a Provider whose children only call useControls still counts.
    useAutoStart();
    return <ViewsContext.Provider value={views}>{children}</ViewsContext.Provider>;
  };
  Provider.displayName = `${displayBase}.Provider`;

  const StepRenderer = ({ fallback = null }: JourneyStepRendererProps) => {
    const views = React.useContext(ViewsContext);
    if (views === null) {
      throw new Error(
        `${displayBase}.StepRenderer must be rendered inside this bundle's <Provider>.`
      );
    }
    const currentStepId = useSelector(selectStepId);
    if (currentStepId === undefined || !(currentStepId in views)) {
      return <>{fallback}</>;
    }
    // Keyed by id: moving steps remounts the view instead of reconciling
    // across steps.
    return <React.Fragment key={currentStepId}>{views[currentStepId as TStepId]}</React.Fragment>;
  };
  StepRenderer.displayName = `${displayBase}.StepRenderer`;

  return {
    machine,
    Provider,
    StepRenderer,
    useSnapshot: () => useSelector(selectSnapshot),
    useSelector,
    useStep: () => useSelector(selectStep),
    useContextSelector: (selector, equalityFn) => {
      // Composed once per distinct `selector` rather than inline at the
      // useSelector call: an inline composition would be a fresh closure every
      // render, rebuilding useSelector's cache each time. Value identity would
      // still hold (the committed ref guarantees that), but the cache would
      // never hit its same-snapshot fast path.
      const selectFromSnapshot = React.useMemo(
        () => (snapshot: TSnapshot) => selector(snapshot.context),
        [selector]
      );
      return useSelector(selectFromSnapshot, equalityFn);
    },
    useEventEffect: (event, listener) => {
      // Latest-ref: inline listeners change identity every render; the machine
      // subscription must not tear down (and miss events) on each one. The ref
      // advances from an effect, never during render, so a discarded render
      // cannot leave it pointing at a closure that was never committed.
      const listenerRef = React.useRef(listener);
      useSafeLayoutEffect(() => {
        listenerRef.current = listener;
      });
      useSafeLayoutEffect(
        () =>
          runtime.subscriptions.subscribeEvent(event, (payload) =>
            // Correlated-union cast: TypeScript cannot connect the generic
            // event name to its payload through the ref indirection.
            listenerRef.current(payload as never)
          ),
        [event]
      );
      // Declared last on purpose: this listener must be attached before the
      // start effect runs, or it misses the journey's very first stepEnter.
      useAutoStart();
    },
    controls: machine.controls,
    updateContext: (updater) => runtime.context.update(updater)
  };
};
