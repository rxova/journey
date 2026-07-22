import React from "react";
import { createGraphJourney as coreCreateGraphJourney } from "@rxova/journey-core";
import { useJourneyEvent } from "../headless/use-journey-event";
import { useJourneySelector } from "../headless/use-journey-selector";
import { useJourneySnapshot } from "../headless/use-journey-snapshot";
import { useJourneyStepLifecycle } from "../headless/use-journey-step-lifecycle";
import { useOwnedJourney } from "../headless/use-owned-journey";
import { useStepAsyncState } from "../headless/use-step-async-state";
import { useSafeLayoutEffect } from "../headless/use-safe-layout-effect";
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
import type { GraphJourneyBundle, GraphProviderProps } from "./graph.types";

export type { GraphJourneyBundle, GraphProviderProps } from "./graph.types";

/**
 * Creates a graph journey bundle for React. **No machine is created at module
 * scope** — the definition is captured and a machine is created per
 * `<Provider>` mount (StrictMode-safe, disposed on unmount). Multiple
 * Providers are independent instances.
 *
 * ```tsx
 * const checkout = createGraphJourney({ steps, transitions, initial: "cart", context });
 *
 * <checkout.Provider views={{ cart: Cart, shipping: Shipping }}>
 *   <ProgressHeader />
 *   <checkout.StepRenderer fallback={<Spinner />} />
 * </checkout.Provider>
 * ```
 *
 * Hooks are namespaced on the bundle (`checkout.useApi()`); the machine's
 * command groups pass through verbatim.
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

  const MachineContext = React.createContext<Machine | null>(null);
  const ViewsContext = React.createContext<Record<string, React.ComponentType> | null>(null);

  const useMachine = (): Machine => {
    const machine = React.useContext(MachineContext);
    if (machine === null) {
      throw new Error("Graph journey hooks must be called inside this bundle's <Provider>.");
    }
    return machine;
  };

  // Inside this generic body the machine's type parameters are unresolved,
  // which defeats method-bivariance against AnyJourneyMachine — the headless
  // hooks get the erased view and the bundle re-asserts the concrete types.
  const useLooseMachine = (): AnyJourneyMachine => useMachine() as unknown as AnyJourneyMachine;

  const Provider = ({
    views,
    context: contextOverride,
    autoStart = true,
    onError,
    machineRef,
    children
  }: GraphProviderProps<TContext, TStepId>) => {
    const onErrorRef = React.useRef(onError);
    onErrorRef.current = onError;

    // Machine per mount: useOwnedJourney runs the factory once (StrictMode-safe)
    // and disposes on real unmount. `autoStart` is a creation option, so the
    // first snapshot already has the initial step.
    const machine = useOwnedJourney(() => {
      const mergedDefinition =
        contextOverride === undefined
          ? definition
          : { ...definition, context: { ...definition.context, ...contextOverride } };
      return coreCreateGraphJourney(
        mergedDefinition as never,
        {
          ...options,
          autoStart
        } as never
      ) as unknown as Machine;
    });

    useSafeLayoutEffect(() => {
      if (typeof machineRef === "function") {
        machineRef(machine);
      } else if (machineRef) {
        (machineRef as React.MutableRefObject<unknown>).current = machine;
      }
      return () => {
        if (typeof machineRef === "function") {
          machineRef(null);
        } else if (machineRef) {
          (machineRef as React.MutableRefObject<unknown>).current = null;
        }
      };
    }, [machine, machineRef]);

    return (
      <MachineContext.Provider value={machine}>
        <ViewsContext.Provider value={views}>{children}</ViewsContext.Provider>
      </MachineContext.Provider>
    );
  };

  const StepRenderer = ({ fallback = null }: { fallback?: React.ReactNode }) => {
    const views = React.useContext(ViewsContext);
    if (views === null) {
      throw new Error("StepRenderer must be rendered inside this bundle's <Provider>.");
    }
    const currentStepId = useJourneySelector(
      useLooseMachine(),
      (snapshot) => snapshot.currentStep?.id
    );
    const StepComponent = currentStepId === undefined ? undefined : views[currentStepId];

    if (!StepComponent) {
      return <>{fallback}</>;
    }

    return (
      <React.Fragment key={currentStepId}>
        <StepComponent />
      </React.Fragment>
    );
  };

  const bundle: GraphJourneyBundle<TContext, TStepId, TEvents, TMeta, TPlugins> = {
    Provider,
    StepRenderer,
    useSnapshot: () =>
      useJourneySnapshot(useLooseMachine()) as unknown as GraphSnapshot<
        TContext,
        TStepId,
        TMeta,
        TEvents
      >,
    useSelector: (selector, equalityFn) =>
      useJourneySelector(useLooseMachine(), selector as never, equalityFn as never) as ReturnType<
        typeof selector
      >,
    useApi: () => {
      const machine = useMachine();
      return React.useMemo(
        () => ({
          controls: machine.controls,
          navigate: machine.navigate,
          send: machine.send,
          updateContext: (updater: (context: TContext) => TContext) =>
            machine.context.update(updater)
        }),
        [machine]
      );
    },
    useStepAsyncState: (stepId) => useStepAsyncState(useLooseMachine(), stepId as never),
    useEvent: (event, listener) => useJourneyEvent(useLooseMachine(), event, listener as never),
    useStepLifecycle: (stepId, callbacks) =>
      useJourneyStepLifecycle(useLooseMachine(), stepId as never, callbacks as never),
    useMachine
  };

  return bundle;
}
