import React from "react";
import { createLinearJourney as coreCreateLinearJourney } from "@rxova/journey-core";
import { useSafeLayoutEffect } from "./use-safe-layout-effect";
import type { LinearStepIdOf, LinearStepInput } from "@rxova/journey-core";
import type {
  JourneyProviderProps,
  JourneyViews,
  LinearJourneyBundle,
  LinearJourneyBundleDefinition,
  LinearJourneyBundleOptions,
  LinearJourneyMachine,
  LinearJourneySnapshot,
  LinearJourneyStepHandler
} from "./react.types";

const stepIdOf = (step: string | { readonly id: string }): string =>
  typeof step === "string" ? step : step.id;

/**
 * Creates a linear journey bundle for React around **one standalone machine**,
 * created right here in the factory — the same shape as the graph bundle,
 * with the linear verbs. `TContext` is inferred from `definition.context`
 * (annotate the value, e.g. `const initialContext: SignupContext = {...}`),
 * the step-id union from the `steps` tuple; call sites never pass generics.
 *
 * ```tsx
 * const signup = createLinearJourney({
 *   name: "signup",
 *   context: initialContext,
 *   steps: ["email", "review", "done"]
 * });
 *
 * <signup.Provider views={{ email: <EmailStep />, review: <ReviewStep />, done: <DoneStep /> }}>
 *   <ProgressHeader />
 *   <signup.StepRenderer fallback={<Spinner />} />
 *   <Controls />
 * </signup.Provider>;
 *
 * void signup.navigate.goToNextStep();   // from anywhere
 * const step = signup.useStep();         // from any component
 * ```
 *
 * The machine outlives any component: every hook closes over it and works
 * with or without the Provider, non-React code drives it via `bundle.machine`
 * / `bundle.navigate` / `bundle.updateContext`, and unmounting disposes
 * nothing. All Providers and hooks share the one machine, journey state
 * survives remounts (reset explicitly — `controls.restart()` after a terminal
 * status, `terminate()` first when mid-flight), and in SSR the module-scope
 * machine is shared across requests — for per-mount or per-request isolation,
 * own a core machine yourself and read it with `React.useSyncExternalStore`.
 * `autoStart` defaults to `true` here (the React-tier default); pass
 * `{ autoStart: false }` and call `bundle.machine.controls.start()` to defer
 * the initial entry.
 */
export const createLinearJourney = <
  TContext,
  const TSteps extends readonly [
    LinearStepInput<NoInfer<TContext>, unknown>,
    ...LinearStepInput<NoInfer<TContext>, unknown>[]
  ]
>(
  definition: LinearJourneyBundleDefinition<TContext, TSteps>,
  options?: LinearJourneyBundleOptions<LinearStepIdOf<TSteps>>
): LinearJourneyBundle<TContext, LinearStepIdOf<TSteps>> => {
  type TStepId = LinearStepIdOf<TSteps>;
  type Machine = LinearJourneyMachine<TContext, TStepId>;
  type Snapshot = LinearJourneySnapshot<TContext, TStepId>;

  const declaredStepIds = definition.steps.map(stepIdOf);
  if (declaredStepIds.length === 0) {
    throw new Error("createLinearJourney() needs at least one step in the definition.");
  }
  if (new Set(declaredStepIds).size !== declaredStepIds.length) {
    throw new Error(
      `createLinearJourney() step ids must be unique; received [${declaredStepIds.join(", ")}].`
    );
  }

  const machine = coreCreateLinearJourney(
    { steps: definition.steps as never, context: definition.context as unknown },
    { ...options, autoStart: options?.autoStart ?? true }
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

  const ViewsContext = React.createContext<JourneyViews<TStepId> | null>(null);

  const Provider = ({ views, children }: JourneyProviderProps<TStepId>): React.ReactElement => (
    <ViewsContext.Provider value={views}>{children}</ViewsContext.Provider>
  );
  Provider.displayName = definition.name ? `${definition.name}.Provider` : "LinearJourney.Provider";

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
    useStepHandler: <TResult = void,>(
      stepId: TStepId,
      handler: LinearJourneyStepHandler<TContext, TResult>
    ): void => {
      // Latest-ref, same reason as above; registration is per mounted caller.
      const handlerRef = React.useRef(handler);
      handlerRef.current = handler;
      useSafeLayoutEffect(() => {
        const work: LinearJourneyStepHandler<TContext, TResult> = {
          run: (args) => handlerRef.current.run(args),
          commit: (args) => handlerRef.current.commit?.(args)
        };
        return machine.navigate.registerNextStepInterceptor(stepId, work as never);
      }, [stepId]);
    },
    navigate: machine.navigate,
    updateContext: (updater) => machine.context.update(updater)
  };
};
