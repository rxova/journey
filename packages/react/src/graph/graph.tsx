import React from "react";
import { createGraphJourney as coreCreateGraphJourney } from "@rxova/journey-core";
import { useSafeLayoutEffect } from "../headless/use-safe-layout-effect";
import type {
  AnyJourneyPlugin,
  GraphJourneyMachine,
  GraphJourneyOptions,
  GraphSnapshot,
  GraphStepConfig,
  GraphTransitionsMap,
  JourneyEventObject
} from "@rxova/journey-core";
import type { GraphJourneyBundle, GraphJourneyViews, GraphProviderProps } from "./graph.types";

export type { GraphJourneyBundle, GraphJourneyViews, GraphProviderProps } from "./graph.types";

/**
 * Creates a graph journey bundle for React around **one standalone machine**,
 * created right here in the factory. The machine outlives any component:
 * every hook closes over it and works with or without the Provider, non-React
 * code drives it via `bundle.machine` / `bundle.send` / `bundle.updateContext`,
 * and unmounting disposes nothing. The Provider only hands `views` to
 * `<StepRenderer>` — which renders the active step wherever you place it, so
 * headers and footers are ordinary siblings:
 *
 * ```tsx
 * const checkout = createGraphJourney({ steps, transitions, initial: "cart", context });
 *
 * <checkout.Provider views={{ cart: <Cart />, shipping: <Shipping /> }}>
 *   <ProgressHeader />
 *   <checkout.StepRenderer fallback={<Spinner />} />
 *   <Footer />
 * </checkout.Provider>;
 *
 * checkout.send("SUBMIT");            // from anywhere
 * const step = checkout.useStep();    // from any component
 * ```
 *
 * Consequences of the standalone machine: all Providers and hooks share the
 * one machine, journey state survives remounts (reset explicitly —
 * `controls.restart()` after a terminal status, `terminate()` first when
 * mid-flight), and in SSR the module-scope machine is shared across
 * requests — for per-mount or per-request isolation, own a core machine
 * yourself and read it with `React.useSyncExternalStore`. `autoStart`
 * defaults to `true` here (the React-tier default); pass `{ autoStart: false }`
 * and call `bundle.machine.controls.start()` to defer the initial entry.
 */
export function createGraphJourney<
  TContext,
  TStepId extends string,
  TEvents extends JourneyEventObject = JourneyEventObject,
  THandlers = unknown,
  TMeta = Record<string, unknown>,
  const TPlugins extends readonly AnyJourneyPlugin[] = readonly []
>(
  definition: {
    readonly steps: Readonly<
      Record<TStepId, GraphStepConfig<NoInfer<TContext>, NoInfer<TStepId>, NoInfer<TEvents>, TMeta>>
    >;
    readonly transitions: GraphTransitionsMap<
      NoInfer<TContext>,
      NoInfer<TStepId>,
      NoInfer<TEvents>,
      NoInfer<THandlers>,
      NoInfer<TMeta>
    >;
    readonly initial: NoInfer<TStepId>;
    readonly context: TContext;
    readonly handlers?: THandlers;
    readonly $events?: TEvents;
  },
  options?: GraphJourneyOptions<NoInfer<THandlers>, TPlugins>
): GraphJourneyBundle<TContext, TStepId, TEvents, TMeta, TPlugins> {
  type Machine = GraphJourneyMachine<TContext, TStepId, TEvents, TMeta, TPlugins>;
  type Snapshot = GraphSnapshot<TContext, TStepId, TMeta, TEvents>;

  const machine = coreCreateGraphJourney(
    definition as never,
    { ...options, autoStart: options?.autoStart ?? true } as never
  ) as unknown as Machine;

  // The machine is a factory-scoped singleton, so this subscribe adapter is a
  // stable plain function — useSyncExternalStore never resubscribes on it.
  const subscribe = (onStoreChange: () => void) =>
    machine.subscriptions.subscribeSelector((snapshot) => snapshot, onStoreChange);

  /**
   * The one React bridge in this bundle. useSyncExternalStore requires the
   * getter to return a STABLE reference while the selected value is unchanged
   * (an unstable object identity re-renders forever), and the machine
   * subscription must not churn with inline selectors — the render-scoped
   * cache below provides both; everything else reads the machine directly.
   */
  const useSelector = <TSelected,>(
    selector: (snapshot: Snapshot) => TSelected,
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
      const snapshot = machine.getSnapshot() as unknown as Snapshot;
      const cached = cacheRef.current;
      const sameDerivation =
        cached !== null &&
        Object.is(cached.selector, selector) &&
        Object.is(cached.isEqual, isEqual);

      if (sameDerivation && Object.is(cached.snapshot, snapshot)) {
        return cached.selected;
      }
      const next = selector(snapshot);
      const selected = sameDerivation && isEqual(cached.selected, next) ? cached.selected : next;
      cacheRef.current = { snapshot, selected, selector, isEqual };
      return selected;
    };

    return React.useSyncExternalStore(subscribe, getSelected, getSelected);
  };

  const ViewsContext = React.createContext<GraphJourneyViews<TStepId> | null>(null);

  const Provider = ({ views, children }: GraphProviderProps<TStepId>) => (
    <ViewsContext.Provider value={views}>{children}</ViewsContext.Provider>
  );

  const StepRenderer = ({ fallback = null }: { fallback?: React.ReactNode }) => {
    const views = React.useContext(ViewsContext);
    if (views === null) {
      throw new Error("StepRenderer must be rendered inside this bundle's <Provider>.");
    }
    const currentStepId = useSelector((snapshot) => snapshot.currentStep?.id);
    if (currentStepId === undefined || !(currentStepId in views)) {
      return <>{fallback}</>;
    }
    // Keyed by id: moving steps remounts the view instead of reconciling
    // across steps.
    return <React.Fragment key={currentStepId}>{views[currentStepId]}</React.Fragment>;
  };

  return {
    machine,
    Provider,
    StepRenderer,
    useSnapshot: () => useSelector((snapshot) => snapshot),
    useSelector,
    useStep: () => useSelector((snapshot) => snapshot.currentStep),
    useContext: () => useSelector((snapshot) => snapshot.context),
    useSubscribeEvent: (event, listener) => {
      // Latest-ref: inline listeners change identity every render; the machine
      // subscription must not tear down (and miss events) on each one.
      const listenerRef = React.useRef(listener);
      listenerRef.current = listener;
      useSafeLayoutEffect(
        () =>
          machine.subscriptions.subscribeEvent(event, (payload) =>
            listenerRef.current(payload as never)
          ),
        [event]
      );
    },
    useMachine: () => machine,
    useControls: () => machine.controls,
    useNavigation: () => machine.navigate,
    send: machine.send,
    updateContext: (updater) => machine.context.update(updater)
  };
}
