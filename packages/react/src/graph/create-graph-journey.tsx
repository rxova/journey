/* eslint-disable no-redeclare */
import React from "react";

import { createGraphJourney as coreCreateGraphJourney } from "@rxova/journey-core";

import {
  useJourneyComputed as useHeadlessComputed,
  useJourneyEvent as useHeadlessEvent,
  useJourneySelector as useHeadlessSelector,
  useJourneySnapshot as useHeadlessSnapshot,
  useJourneyStepLifecycle as useHeadlessStepLifecycle,
  useStepAsyncState as useHeadlessStepAsyncState
} from "../headless/hooks";

import type {
  AssertNoSelfTransitions,
  GraphJourneyDefinition,
  GraphJourneySnapshot,
  JourneyBaseEvent,
  JourneyBuilderCustomEventKey,
  JourneyComputed,
  JourneyDefinition,
  JourneyEqualityFn,
  JourneyJsonObject,
  JourneyMachineOptions,
  JourneyMachinePlugin,
  JourneyMachineWithPlugins,
  JourneyObservationEvent,
  JourneySelector,
  JourneyStepAsyncState
} from "@rxova/journey-core";
import type { JourneyEmpty } from "@rxova/journey-core";
import type {
  JourneyGlobalHandledCustomEventTypeFromDefinition,
  JourneyHandlersOfDefinition,
  JourneyOptionsInput,
  JourneyStepHandledCustomEventMapFromDefinition
} from "../type-helpers";
import type { JourneyApi, StepScopedJourneyApi } from "../types";

const useSafeLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

export type GraphProviderProps<TContext extends JourneyJsonObject, TStepId extends string> = {
  /** Step id → component. The definition stays pure data; views live here. */
  views: Record<TStepId, React.ComponentType>;
  /** Per-mount context override, shallow-merged over the definition's context. */
  context?: Partial<TContext>;
  /** Start the journey automatically when idle. Default true. */
  autoStart?: boolean;
  onError?: (error: unknown, context: { phase: "start" }) => void;
  /** Imperative escape hatch to this mount's machine. */
  machineRef?: React.Ref<unknown>;
  children: React.ReactNode;
};

/** The graph bundle: Provider/StepRenderer plus prefix-less namespaced hooks. */
export type GraphJourneyBundle<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TPlugins extends readonly JourneyMachinePlugin[] = [],
  TStepHandledCustomEventMap extends Record<TStepId, JourneyBuilderCustomEventKey<TEvents>> =
    Record<TStepId, never>,
  TGlobalHandledCustomEventType extends JourneyBuilderCustomEventKey<TEvents> = never
> = {
  Provider: React.ComponentType<GraphProviderProps<TContext, TStepId>>;
  StepRenderer: React.ComponentType<{ fallback?: React.ReactNode }>;
  useSnapshot: () => GraphJourneySnapshot<TContext, TStepId>;
  useComputed: () => JourneyComputed<TStepId>;
  useSelector: <TSelected>(
    selector: JourneySelector<TContext, TStepId, TSelected>,
    equalityFn?: JourneyEqualityFn<TSelected>
  ) => TSelected;
  useApi: () => JourneyApi<TContext, TStepId, TEvents, TStepMeta>;
  useStepApi: <TStepKey extends TStepId>(
    stepId: TStepKey
  ) => StepScopedJourneyApi<
    TContext,
    TStepId,
    TEvents,
    Extract<TStepHandledCustomEventMap[TStepKey] | TGlobalHandledCustomEventType, TEvents["type"]>,
    TStepMeta
  >;
  useStepAsyncState: (stepId: TStepId) => JourneyStepAsyncState;
  useEvent: (listener: (event: JourneyObservationEvent<TStepId, TEvents>) => void) => void;
  useStepLifecycle: (
    stepId: TStepId,
    callbacks: {
      onEnter?: (args: { context: TContext }) => void;
      onLeave?: (args: { context: TContext }) => void;
    }
  ) => void;
  useMachine: () => JourneyMachineWithPlugins<
    TContext,
    TStepId,
    TEvents,
    TStepMeta,
    THandlers,
    TPlugins
  >;
};

export type GraphJourneyBundleFromDefinition<
  TDefinition,
  TPlugins extends readonly JourneyMachinePlugin[] = []
> =
  TDefinition extends JourneyDefinition<
    infer TContext,
    infer TStepId,
    infer TEvents,
    infer TStepMeta,
    infer THandlers
  >
    ? GraphJourneyBundle<
        Extract<TContext, JourneyJsonObject>,
        Extract<TStepId, string>,
        Extract<TEvents, JourneyBaseEvent>,
        TStepMeta,
        Extract<THandlers, Record<string, unknown>>,
        TPlugins,
        JourneyStepHandledCustomEventMapFromDefinition<
          TDefinition,
          Extract<TStepId, string>,
          Extract<TEvents, JourneyBaseEvent>
        >,
        JourneyGlobalHandledCustomEventTypeFromDefinition<
          TDefinition,
          Extract<TStepId, string>,
          Extract<TEvents, JourneyBaseEvent>
        >
      >
    : never;

type AnyGraphMachine = JourneyMachineWithPlugins<
  JourneyJsonObject,
  string,
  JourneyBaseEvent,
  unknown,
  Record<string, unknown>,
  readonly JourneyMachinePlugin[]
>;

const bindApi = (machine: AnyGraphMachine) => ({
  startJourney: machine.startJourney,
  send: machine.send,
  goToNextStep: machine.goToNextStep,
  goToStepById: machine.goToStepById,
  terminateJourney: machine.terminateJourney,
  completeJourney: machine.completeJourney,
  goToPreviousStep: machine.goToPreviousStep,
  goToLastVisitedStep: machine.goToLastVisitedStep,
  clearStepError: machine.clearStepError,
  updateContext: machine.updateContext,
  getStepMeta: machine.getStepMeta,
  pauseJourney: machine.pauseJourney,
  resumeJourney: machine.resumeJourney,
  isPaused: machine.isPaused,
  resetJourney: () => machine.resetJourney()
});

/**
 * Creates a graph journey bundle for React. Unlike the pre-1.0 runtime-object
 * API, **no machine is created at module scope** — the definition is captured
 * and a machine is created per `<Provider>` mount (StrictMode-safe, disposed
 * on unmount). Multiple Providers are independent instances.
 *
 * ```tsx
 * const checkout = createGraphJourney({ initial: "cart", context, steps, transitions });
 *
 * <checkout.Provider views={{ cart: Cart, shipping: Shipping }}>
 *   <ProgressHeader />
 *   <checkout.StepRenderer fallback={<Spinner />} />
 * </checkout.Provider>
 * ```
 *
 * Hooks are namespaced on the bundle (`checkout.useApi()`), so they drop the
 * `Journey` prefix; machine method names inside are unchanged.
 */
export function createGraphJourney<
  const TDefinition,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  definition: TDefinition & AssertNoSelfTransitions<NoInfer<TDefinition>>,
  options?: JourneyOptionsInput<TPlugins, JourneyHandlersOfDefinition<TDefinition>>
): GraphJourneyBundleFromDefinition<TDefinition, TPlugins>;
export function createGraphJourney<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  definition: GraphJourneyDefinition<TContext, TStepId, TEvents, TStepMeta, THandlers>,
  options?: JourneyOptionsInput<TPlugins, THandlers>
): GraphJourneyBundle<TContext, TStepId, TEvents, TStepMeta, THandlers, TPlugins> {
  type Machine = AnyGraphMachine;

  const MachineContext = React.createContext<Machine | null>(null);
  const ViewsContext = React.createContext<Record<string, React.ComponentType> | null>(null);

  const useMachine = (): Machine => {
    const machine = React.useContext(MachineContext);
    if (machine === null) {
      throw new Error("Graph journey hooks must be called inside this bundle's <Provider>.");
    }
    return machine;
  };

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

    // Machine per mount: lazy ref init (StrictMode-safe single creation),
    // scheduled dispose cancelled by a StrictMode remount.
    const machineInternalRef = React.useRef<Machine | null>(null);
    if (machineInternalRef.current === null) {
      const mergedDefinition =
        contextOverride === undefined
          ? definition
          : {
              ...(definition as Record<string, unknown>),
              context: {
                ...(definition as { context: JourneyJsonObject }).context,
                ...contextOverride
              }
            };
      machineInternalRef.current = coreCreateGraphJourney(
        mergedDefinition as never,
        options as JourneyMachineOptions<TPlugins, Record<string, unknown>> | undefined
      ) as unknown as Machine;
    }
    const machine = machineInternalRef.current;

    const scheduledDisposeRef = React.useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
    useSafeLayoutEffect(() => {
      if (scheduledDisposeRef.current !== null) {
        globalThis.clearTimeout(scheduledDisposeRef.current);
        scheduledDisposeRef.current = null;
      }
      return () => {
        scheduledDisposeRef.current = globalThis.setTimeout(() => {
          scheduledDisposeRef.current = null;
          machineInternalRef.current?.dispose();
          machineInternalRef.current = null;
        }, 0);
      };
    }, []);

    useSafeLayoutEffect(() => {
      if (typeof machineRef === "function") {
        machineRef(machine);
      } else if (machineRef) {
        (machineRef as React.MutableRefObject<unknown>).current = machine;
      }

      if (autoStart && machine.getSnapshot().status === "idled") {
        machine.startJourney().catch((error: unknown) => {
          if (onErrorRef.current) {
            onErrorRef.current(error, { phase: "start" });
            return;
          }
          console.error("Graph journey Provider start failed.", error);
        });
      }
    }, [machine, autoStart, machineRef]);

    return (
      <MachineContext.Provider value={machine}>
        <ViewsContext.Provider value={views}>{children}</ViewsContext.Provider>
      </MachineContext.Provider>
    );
  };

  const StepRenderer = ({ fallback = null }: { fallback?: React.ReactNode }) => {
    const machine = useMachine();
    const views = React.useContext(ViewsContext);
    if (views === null) {
      throw new Error("StepRenderer must be rendered inside this bundle's <Provider>.");
    }
    const currentStepId = useHeadlessSelector(machine, (snapshot) => snapshot.currentStepId);
    const StepComponent = views[currentStepId];

    if (!StepComponent) {
      return <>{fallback}</>;
    }

    return (
      <React.Fragment key={currentStepId}>
        <StepComponent />
      </React.Fragment>
    );
  };

  const bundle: GraphJourneyBundle<TContext, TStepId, TEvents, TStepMeta, THandlers, TPlugins> = {
    Provider,
    StepRenderer,
    useSnapshot: () =>
      useHeadlessSnapshot(useMachine()) as unknown as GraphJourneySnapshot<TContext, TStepId>,
    useComputed: () => useHeadlessComputed(useMachine()) as JourneyComputed<TStepId>,
    useSelector: (selector, equalityFn) =>
      useHeadlessSelector(useMachine(), selector as never, equalityFn) as ReturnType<
        typeof selector
      >,
    useApi: () => {
      const machine = useMachine();
      return React.useMemo(() => bindApi(machine), [machine]) as unknown as JourneyApi<
        TContext,
        TStepId,
        TEvents,
        TStepMeta
      >;
    },
    useStepApi: (stepId) => {
      const machine = useMachine();
      void stepId;
      return React.useMemo(() => bindApi(machine), [machine]) as unknown as ReturnType<
        GraphJourneyBundle<TContext, TStepId, TEvents, TStepMeta, THandlers, TPlugins>["useStepApi"]
      >;
    },
    useStepAsyncState: (stepId) => useHeadlessStepAsyncState(useMachine(), stepId),
    useEvent: (listener) => useHeadlessEvent(useMachine(), listener as never),
    useStepLifecycle: (stepId, callbacks) =>
      useHeadlessStepLifecycle(useMachine(), stepId, callbacks as never),
    useMachine: () =>
      useMachine() as unknown as JourneyMachineWithPlugins<
        TContext,
        TStepId,
        TEvents,
        TStepMeta,
        THandlers,
        TPlugins
      >
  };

  return bundle;
}
