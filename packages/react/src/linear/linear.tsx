import React from "react";
import { createLinearJourney } from "@rxova/journey-core";
import { errorInDevelopment } from "@rxova/journey-common/dev";
import { useJourneySnapshot } from "../headless/use-journey-snapshot";
import { deriveStepsFromChildren } from "./derive-steps";
import { LinearJourneyActiveStepContext, LinearJourneyMachineContext } from "./machine-context";
import { LinearJourneyStep } from "./linear-journey-step";
import type { DerivedLinearJourneyStep } from "./derive-steps";
import type { LinearJourneyMachine, LinearJourneyProps } from "./linear.types";

const useSafeLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/** Signature used to detect step-list changes across renders (order-sensitive). */
const stepListSignature = (steps: readonly DerivedLinearJourneyStep[]): string =>
  steps.map((step) => step.id).join(" ");

const assignMachineRef = <TContext, TStepId extends string>(
  ref: LinearJourneyProps<TContext, TStepId>["machineRef"],
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

/** Internal prop set by createLinearJourney (the typed factory): the declared id set. */
type LinearJourneyInternalProps<TContext> = LinearJourneyProps<TContext> & {
  declaredStepIds?: readonly string[];
};

const assertDeclaredIds = (
  steps: readonly DerivedLinearJourneyStep[],
  declared: readonly string[]
): void => {
  const derived = new Set(steps.map((step) => step.id));
  const missing = declared.filter((id) => !derived.has(id));
  const extra = steps.filter((step) => !declared.includes(step.id)).map((step) => step.id);
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      "<LinearJourney> children don't match the step ids declared in createLinearJourney(): " +
        `${missing.length > 0 ? `missing [${missing.join(", ")}]` : ""}` +
        `${missing.length > 0 && extra.length > 0 ? "; " : ""}` +
        `${extra.length > 0 ? `undeclared [${extra.join(", ")}]` : ""}.`
    );
  }
};

const LinearJourneyComponent = <TContext,>(
  props: LinearJourneyInternalProps<TContext>
): React.ReactElement => {
  const {
    children,
    context,
    startIndex,
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
    persist,
    plugins,
    machineRef,
    declaredStepIds
  } = props;

  if (startIndex !== undefined && startIndex !== 0 && startAt !== undefined) {
    errorInDevelopment(
      "<LinearJourney> received both startIndex and startAt; startAt wins. Remove one."
    );
  }

  // Steps are re-derived every render so the active element always carries the
  // latest child props, but the machine below is built once from the first
  // derivation: the id list is frozen at mount.
  const steps = deriveStepsFromChildren(children);
  if (declaredStepIds !== undefined) {
    assertDeclaredIds(steps, declaredStepIds);
  }

  // Callback refs: subscriptions below stay stable across re-renders while
  // always seeing the latest callbacks.
  const callbacksRef = React.useRef({ onStart, onStepEnter, onStepLeave, onComplete, onError });
  callbacksRef.current = { onStart, onStepEnter, onStepLeave, onComplete, onError };

  // Machine ownership: lazy ref init so StrictMode's double render creates
  // exactly one machine, fixed for the lifetime of the mount. All linear
  // semantics — start position, persist, step work — are core creation options.
  const machineRefInternal = React.useRef<LinearJourneyMachine | null>(null);
  if (machineRefInternal.current === null) {
    if (steps.length === 0) {
      throw new Error("<LinearJourney> needs at least one step.");
    }
    const resolvedStartAt =
      startAt ?? (startIndex !== undefined && startIndex !== 0 ? steps[startIndex]?.id : undefined);
    machineRefInternal.current = createLinearJourney(
      {
        steps: steps.map((step) => ({ id: step.id, ...step.config })) as never,
        context: (context ?? {}) as unknown
      },
      {
        autoStart: true,
        ...(resolvedStartAt !== undefined ? { startAt: resolvedStartAt } : {}),
        ...(persist !== undefined ? { persist } : {}),
        plugins: plugins ?? []
      }
    ) as unknown as LinearJourneyMachine;
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

  // Frozen step list: conditional/dynamic children are not supported — that
  // flow belongs to the graph tier. The mounted machine keeps running on the
  // original id list.
  const signature = stepListSignature(steps);
  const mountedSignatureRef = React.useRef(signature);
  if (mountedSignatureRef.current !== signature) {
    errorInDevelopment(
      "<LinearJourney> derived a different step id list than it mounted with " +
        `(mounted "${mountedSignatureRef.current}", now "${signature}"). ` +
        "The step list is frozen at mount; conditional steps belong to the graph tier. " +
        "Remount with a `key` to rebuild the journey."
    );
  }

  // Imperative machineRef, onStart, and verbatim event → prop forwarding.
  const startReportedRef = React.useRef(false);
  useSafeLayoutEffect(() => {
    assignMachineRef(machineRef, machine as never);

    // Once per mounted journey (the ref guard absorbs StrictMode's double
    // effect). The machine autostarts at creation, so the start snapshot
    // already sits on the resolved start step.
    if (!startReportedRef.current) {
      startReportedRef.current = true;
      const startSnapshot = machine.getSnapshot();
      callbacksRef.current.onStart?.(startSnapshot as never);
    }

    const subscriptions = machine.subscriptions;
    const unsubscribes = [
      subscriptions.subscribeEvent("stepEnter", (payload) => {
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

    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
      assignMachineRef(machineRef, null);
    };
    // machineRef identity changes are deliberately not resubscribed on.
  }, [machine]);

  const snapshot = useJourneySnapshot(machine);
  const activeStep = steps.find((step) => step.id === snapshot.currentStep?.id);

  let activeNode: React.ReactNode;
  if (activeStep) {
    activeNode = (
      <LinearJourneyActiveStepContext.Provider key={activeStep.id} value={activeStep.id}>
        {activeStep.element}
      </LinearJourneyActiveStepContext.Provider>
    );
  } else {
    activeNode = fallback ?? null;
  }

  const wrappedNode = wrapper ? React.cloneElement(wrapper, undefined, activeNode) : activeNode;

  return (
    <LinearJourneyMachineContext.Provider value={machine}>
      {header}
      {wrappedNode}
      {footer}
    </LinearJourneyMachineContext.Provider>
  );
};

type LinearJourneyComponentType = (<TContext = Record<string, never>>(
  props: LinearJourneyProps<TContext>
) => React.ReactElement) & {
  Step: typeof LinearJourneyStep;
};

/**
 * The linear journey tier. Steps are the children — each with a mandatory
 * unique `id`, via an `id` prop or a `<LinearJourney.Step id>` wrapper.
 *
 * ```tsx
 * <LinearJourney header={<Progress />} footer={<Nav />}>
 *   <Email id="email" />
 *   <Password id="password" />
 *   <Confirm id="confirm" />
 * </LinearJourney>
 * ```
 *
 * No provider, no dispose: the machine is created when `<LinearJourney>` mounts
 * (StrictMode-safe) and disposed on unmount. The step id list is frozen at
 * mount. Inside any step, header, or footer, call `useLinearJourney()`.
 */
export const LinearJourney: LinearJourneyComponentType = /*#__PURE__*/ Object.assign(
  LinearJourneyComponent,
  {
    Step: LinearJourneyStep
  }
) as LinearJourneyComponentType;
