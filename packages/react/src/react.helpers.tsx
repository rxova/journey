import React from "react";
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
    subscribeSelector: (
      selector: (snapshot: TSnapshot) => unknown,
      listener: (selected: unknown) => void
    ) => () => void;
    subscribeEvent: (
      event: JourneySubscriptionEvent,
      listener: (payload: unknown) => void
    ) => () => void;
  };
  context: { update: (updater: (context: TContext) => TContext) => unknown };
};

// Hoisted selectors: stable identities let every built-in hook hit the
// same-snapshot fast path in useSelector's cache.
const selectSnapshot = <TSnapshot,>(snapshot: TSnapshot): TSnapshot => snapshot;
const selectStep = <TSnapshot extends { currentStep: unknown }>(
  snapshot: TSnapshot
): TSnapshot["currentStep"] => snapshot.currentStep;
const selectContext = <TSnapshot extends { context: unknown }>(
  snapshot: TSnapshot
): TSnapshot["context"] => snapshot.context;
const selectStepId = <TSnapshot extends { currentStep: { readonly id: string } | null }>(
  snapshot: TSnapshot
): string | undefined => snapshot.currentStep?.id;

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
  displayBase: string
): JourneyBundleBase<TMachine, TContext, TStepId, TSnapshot> => {
  const runtime = machine as unknown as BindableRuntime<TContext, TSnapshot>;

  // The machine is a factory-scoped singleton, so this subscribe adapter is a
  // stable plain function — useSyncExternalStore never resubscribes on it.
  const subscribe = (onStoreChange: () => void) =>
    runtime.subscriptions.subscribeSelector(selectSnapshot, onStoreChange);

  /**
   * The one React bridge in this bundle. useSyncExternalStore requires the
   * getter to return a STABLE reference while the selected value is unchanged
   * (an unstable object identity re-renders forever), and the machine
   * subscription must not churn with inline selectors — the render-scoped
   * cache below provides both; everything else reads the machine directly.
   */
  const useSelector = <TSelected,>(
    selector: (snapshot: TSnapshot) => TSelected,
    equalityFn?: (a: TSelected, b: TSelected) => boolean
  ): TSelected => {
    const isEqual = equalityFn ?? Object.is;
    const cacheRef = React.useRef<{
      snapshot: unknown;
      selected: TSelected;
      selector: unknown;
      isEqual: unknown;
    } | null>(null);

    const getSelected = (): TSelected => {
      const snapshot = runtime.getSnapshot();
      const cached = cacheRef.current;
      const sameDerivation =
        cached !== null &&
        Object.is(cached.selector, selector) &&
        Object.is(cached.isEqual, isEqual);

      if (sameDerivation && Object.is(cached.snapshot, snapshot)) {
        return cached.selected;
      }
      // Value reuse must not require selector identity: inline selectors are
      // fresh closures every render, and the previously selected reference
      // must survive them or equalityFn is dead code off the fast path.
      const next = selector(snapshot);
      const selected = cached !== null && isEqual(cached.selected, next) ? cached.selected : next;
      cacheRef.current = { snapshot, selected, selector, isEqual };
      return selected;
    };

    return React.useSyncExternalStore(subscribe, getSelected, getSelected);
  };

  const ViewsContext = React.createContext<JourneyViews<TStepId> | null>(null);

  const Provider = ({ views, children }: JourneyProviderProps<TStepId>): React.ReactElement => (
    <ViewsContext.Provider value={views}>{children}</ViewsContext.Provider>
  );
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
    useContext: () => useSelector(selectContext) as TContext,
    useSubscribeEvent: (event, listener) => {
      // Latest-ref: inline listeners change identity every render; the machine
      // subscription must not tear down (and miss events) on each one.
      const listenerRef = React.useRef(listener);
      listenerRef.current = listener;
      useSafeLayoutEffect(
        () =>
          runtime.subscriptions.subscribeEvent(event, (payload) =>
            // Correlated-union cast: TypeScript cannot connect the generic
            // event name to its payload through the ref indirection.
            listenerRef.current(payload as never)
          ),
        [event]
      );
    },
    useMachine: () => machine,
    useControls: () => machine.controls,
    useNavigation: () => machine.navigate,
    updateContext: (updater) => runtime.context.update(updater)
  };
};
