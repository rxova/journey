import React from "react";
import { createLinearJourney as coreCreateLinearJourney } from "@rxova/journey-core";
import { errorInDevelopment } from "@rxova/journey-common/dev";
import { useJourneySnapshot } from "../headless/use-journey-snapshot";
import { deriveStepsFromChildren } from "./derive-steps";
import { LinearJourneyActiveStepContext } from "./active-step-context";
import type { DerivedLinearJourneyStep } from "./derive-steps";
import type {
  LinearJourneyBundleDefinition,
  LinearJourneyBundleOptions,
  LinearJourneyMachine,
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
 * Children must cover the definition exactly — the definition is the machine's
 * source of truth, the children only supply what each step renders.
 */
const assertChildrenCoverDefinition = (
  steps: readonly DerivedLinearJourneyStep[],
  declared: readonly string[]
): void => {
  const derived = steps.map((step) => step.id);
  const derivedSet = new Set(derived);
  const missing = declared.filter((id) => !derivedSet.has(id));
  const extra = derived.filter((id) => !declared.includes(id));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      "<Provider> children don't match the step ids declared in createLinearJourney(): " +
        `${missing.length > 0 ? `missing [${missing.join(", ")}]` : ""}` +
        `${missing.length > 0 && extra.length > 0 ? "; " : ""}` +
        `${extra.length > 0 ? `undeclared [${extra.join(", ")}]` : ""}.`
    );
  }
  if (declared.some((id, index) => derived[index] !== id)) {
    errorInDevelopment(
      `<Provider> children are ordered [${derived.join(", ")}] but the definition declares ` +
        `[${declared.join(", ")}]. The definition's order drives the machine; reorder the children to match.`
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
    children,
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

  // Children are re-derived every render so the active element always carries
  // the latest child props; the machine below is built from the definition,
  // and the children must keep covering it on every render.
  const steps = deriveStepsFromChildren(children);
  assertChildrenCoverDefinition(steps, declaredStepIds);

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

  // Children cover the definition exactly (asserted above) and the machine
  // only navigates declared ids, so the active id always has an element.
  const activeStep = steps.find(
    (step) => step.id === snapshot.currentStep?.id
  ) as DerivedLinearJourneyStep;

  const activeNode: React.ReactNode = (
    <LinearJourneyActiveStepContext.Provider key={activeStep.id} value={activeStep.id}>
      {activeStep.element}
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
