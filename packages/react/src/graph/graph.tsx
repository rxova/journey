import React from "react";
import { createGraphJourney as coreCreateGraphJourney } from "@rxova/journey-core";
import { useJourneyEvent } from "../headless/use-journey-event";
import { useJourneySelector } from "../headless/use-journey-selector";
import { useJourneySnapshot } from "../headless/use-journey-snapshot";
import type { AnyJourneyMachine } from "../headless/headless.types";
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
 * requests — per-request or per-mount isolation is the headless tier's job
 * (`useOwnedJourney` + core's `createGraphJourney`). `autoStart` defaults to
 * `true` here (the React-tier default); pass `{ autoStart: false }` and call
 * `bundle.machine.controls.start()` to defer the initial entry.
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

  // Inside this generic body the machine's type parameters are unresolved,
  // which defeats method-bivariance against AnyJourneyMachine — the headless
  // hooks get the erased view and the bundle re-asserts the concrete types.
  const looseMachine = machine as unknown as AnyJourneyMachine;

  const ViewsContext = React.createContext<GraphJourneyViews<TStepId> | null>(null);

  const Provider = ({ views, children }: GraphProviderProps<TStepId>) => (
    <ViewsContext.Provider value={views}>{children}</ViewsContext.Provider>
  );

  const StepRenderer = ({ fallback = null }: { fallback?: React.ReactNode }) => {
    const views = React.useContext(ViewsContext);
    if (views === null) {
      throw new Error("StepRenderer must be rendered inside this bundle's <Provider>.");
    }
    const currentStepId = useJourneySelector(
      looseMachine,
      (snapshot) => snapshot.currentStep?.id as TStepId | undefined
    );
    if (currentStepId === undefined || !(currentStepId in views)) {
      return <>{fallback}</>;
    }
    // Keyed by id: moving steps remounts the view instead of reconciling
    // across steps.
    return <React.Fragment key={currentStepId}>{views[currentStepId]}</React.Fragment>;
  };

  const useSelector = <TSelected,>(
    selector: (snapshot: Snapshot) => TSelected,
    equalityFn?: (a: TSelected, b: TSelected) => boolean
  ): TSelected => useJourneySelector(looseMachine, selector as never, equalityFn) as TSelected;

  return {
    machine,
    Provider,
    StepRenderer,
    useSnapshot: () => useJourneySnapshot(looseMachine) as unknown as Snapshot,
    useSelector,
    useStep: () => useSelector((snapshot) => snapshot.currentStep),
    useContext: () => useSelector((snapshot) => snapshot.context),
    useSubscribeEvent: (event, listener) => useJourneyEvent(looseMachine, event, listener as never),
    useMachine: () => machine,
    useControls: () => machine.controls,
    useNavigation: () => machine.navigate,
    send: machine.send,
    updateContext: (updater) => machine.context.update(updater)
  };
}
