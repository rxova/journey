import React from "react";
import { createLinearJourney as coreCreateLinearJourney } from "@rxova/journey-core";
import { errorInDevelopment } from "@rxova/journey-common/dev";
import { useJourneySnapshot } from "../headless/use-journey-snapshot";
import { LinearJourneyActiveStepContext } from "./active-step-context";
import type {
  LinearJourneyBundleDefinition,
  LinearJourneyBundleOptions,
  LinearJourneyMachine,
  LinearJourneyViews,
  LinearProviderProps
} from "./linear.types";

const useSafeLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

const assignMachineRef = <TContext, TStepId extends string>(
  ref: LinearProviderProps<TContext, TStepId>["machineRef"],
  machine: LinearJourneyMachine<TContext, TStepId> | null
): void => {
  if (!ref) {
    return;
  }
  if (typeof ref === "function") {
    ref(machine as never);
    return;
  }
  (ref as React.MutableRefObject<LinearJourneyMachine<TContext, TStepId> | null>).current = machine;
};

/**
 * Exhaustiveness is enforced by the `views` record type; this runtime check
 * exists for plain-JS callers. A `null`/`undefined` view value is legal (the
 * step renders nothing) — only an absent key is an error.
 */
const assertViewsCoverDefinition = (
  views: LinearJourneyViews<string>,
  declared: readonly string[]
): void => {
  const missing = declared.filter((id) => !(id in views));
  if (missing.length > 0) {
    throw new Error(
      `<Provider> views is missing [${missing.join(", ")}] declared in createLinearJourney().`
    );
  }
  const declaredSet = new Set(declared);
  const undeclared = Object.keys(views).filter((id) => !declaredSet.has(id));
  if (undeclared.length > 0) {
    errorInDevelopment(
      `<Provider> views has undeclared keys [${undeclared.join(", ")}]; they can never render. ` +
        "Declare them as steps in createLinearJourney() or remove them."
    );
  }
};

/** Internal props the factory adds on top of the public Provider props. */
type LinearProviderRuntimeProps<TContext, TStepId extends string> = LinearProviderProps<
  TContext,
  TStepId
> & {
  definition: LinearJourneyBundleDefinition<TContext>;
  declaredStepIds: readonly string[];
  runtimeOptions: LinearJourneyBundleOptions<TStepId> | undefined;
  machineContext: React.Context<LinearJourneyMachine<TContext, TStepId> | null>;
};

/**
 * The runtime behind every bundle's `<Provider>`. The machine is created when
 * the Provider mounts (StrictMode-safe) from the factory's definition — with
 * the `initialContext` and `startAt` props as mount-time overrides — and
 * disposed on unmount. Render stays pure: `autoStart` is forced off at
 * creation and the start runs in a layout effect after subscribers attach, so
 * entry effects and persistence writes never happen during render; until then
 * only `fallback` renders (which is also what SSR emits).
 */
export const LinearJourneyProvider = <TContext, TStepId extends string>(
  props: LinearProviderRuntimeProps<TContext, TStepId>
): React.ReactElement => {
  const {
    views,
    initialContext,
    startAt,
    header,
    footer,
    wrapper,
    fallback,
    onStart,
    onStepEnter,
    onStepLeave,
    onComplete,
    onError,
    machineRef,
    definition,
    declaredStepIds,
    runtimeOptions,
    machineContext
  } = props;

  // Views are read every render so the active view always carries the latest
  // props; the machine below is built from the definition alone.
  assertViewsCoverDefinition(views, declaredStepIds);

  // Callback refs: subscriptions below stay stable across re-renders while
  // always seeing the latest callbacks.
  const callbacksRef = React.useRef({ onStart, onStepEnter, onStepLeave, onComplete, onError });
  callbacksRef.current = { onStart, onStepEnter, onStepLeave, onComplete, onError };

  // Machine ownership: lazy ref init so StrictMode's double render creates
  // exactly one machine, fixed for the lifetime of the mount. Options and the
  // initialContext/startAt overrides are frozen at mount.
  const machineRefInternal = React.useRef<LinearJourneyMachine<TContext, TStepId> | null>(null);
  const autoStartRef = React.useRef(runtimeOptions?.autoStart ?? true);
  if (machineRefInternal.current === null) {
    const resolvedStartAt = startAt ?? runtimeOptions?.startAt;
    machineRefInternal.current = coreCreateLinearJourney(
      {
        steps: definition.steps as never,
        context: (initialContext ?? definition.context) as unknown
      },
      {
        ...runtimeOptions,
        autoStart: false,
        ...(resolvedStartAt !== undefined ? { startAt: resolvedStartAt } : {})
      }
    ) as unknown as LinearJourneyMachine<TContext, TStepId>;
  }
  const machine = machineRefInternal.current;

  // Dispose on real unmount; a StrictMode remount cancels the scheduled
  // disposal so the live machine is preserved.
  const scheduledDisposeRef = React.useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  useSafeLayoutEffect(() => {
    if (scheduledDisposeRef.current !== null) {
      globalThis.clearTimeout(scheduledDisposeRef.current);
      scheduledDisposeRef.current = null;
    }
    return () => {
      scheduledDisposeRef.current = globalThis.setTimeout(() => {
        scheduledDisposeRef.current = null;
        machineRefInternal.current?.dispose();
        machineRefInternal.current = null;
      }, 0);
    };
  }, []);

  // Imperative machineRef, verbatim event → prop forwarding, and the start.
  const startReportedRef = React.useRef(false);
  useSafeLayoutEffect(() => {
    assignMachineRef(machineRef, machine);

    const subscriptions = machine.subscriptions;
    const unsubscribes = [
      subscriptions.subscribeEvent("stepEnter", (payload) => {
        // The first from-null entry IS the start (once per mount: the ref
        // guard absorbs StrictMode's double effect and restarts).
        if (!startReportedRef.current && payload.from === null) {
          startReportedRef.current = true;
          callbacksRef.current.onStart?.(payload.snapshot as never);
        }
        callbacksRef.current.onStepEnter?.(payload as never);
      }),
      subscriptions.subscribeEvent("stepLeave", (payload) => {
        callbacksRef.current.onStepLeave?.(payload as never);
      }),
      subscriptions.subscribeEvent("statusChange", (payload) => {
        if (payload.current === "completed") {
          callbacksRef.current.onComplete?.(payload as never);
        }
      }),
      subscriptions.subscribeEvent("error", (payload) => {
        callbacksRef.current.onError?.(payload as never);
      })
    ];

    // Start after the subscribers attach, outside render: the initial entry's
    // hooks and persistence writes run here, and its stepEnter (from: null)
    // reaches the callback props. A StrictMode re-run is a no-op (not idle).
    if (autoStartRef.current) {
      machine.controls.start();
    }

    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
      assignMachineRef(machineRef, null);
    };
    // machineRef identity changes are deliberately not resubscribed on.
  }, [machine]);

  const snapshot = useJourneySnapshot(machine);

  // Idle only exists before the layout-effect start (first client frame, SSR,
  // or an autoStart: false machine the caller hasn't started yet): render the
  // fallback alone so hook consumers never observe a null currentStep. The
  // start re-renders synchronously before paint, so nothing flashes.
  if (snapshot.currentStep === null) {
    return <machineContext.Provider value={machine}>{fallback ?? null}</machineContext.Provider>;
  }

  // The views record covers the definition and the machine only navigates
  // declared ids, so the active id always has an entry. Keyed by id: moving
  // steps remounts the view instead of reconciling across steps.
  const activeStepId = snapshot.currentStep.id;
  const activeNode: React.ReactNode = (
    <LinearJourneyActiveStepContext.Provider key={activeStepId} value={activeStepId}>
      {views[activeStepId as TStepId]}
    </LinearJourneyActiveStepContext.Provider>
  );

  const wrappedNode = wrapper ? React.cloneElement(wrapper, undefined, activeNode) : activeNode;

  return (
    <machineContext.Provider value={machine}>
      {header}
      {wrappedNode}
      {footer}
    </machineContext.Provider>
  );
};
