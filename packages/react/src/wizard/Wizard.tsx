import React from "react";

import { errorInDevelopment } from "@rxova/journey-common/dev";
import { deriveLinearTransplantSnapshot } from "@rxova/journey-core";

import { useJourneySnapshot } from "../headless/hooks";
import { createWizardMachine } from "./build-machine";
import { deriveStepsFromChildren, deriveStepsFromObject, stepListSignature } from "./derive-steps";
import { WizardActiveStepContext, WizardContext } from "./wizard-context";
import { WizardStep } from "./wizard-step";

import type {
  JourneyJsonObject,
  LinearJourneyMachine,
  LinearJourneySnapshot
} from "@rxova/journey-core";
import type { JourneyEmpty } from "@rxova/journey-core";
import type { DerivedWizardStep } from "./derive-steps";
import type { WizardProps, WizardStepChange } from "./types";
import type { WizardContextValue } from "./wizard-context";

const useSafeLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

type WizardMachine = LinearJourneyMachine<JourneyJsonObject, string>;

const assignMachineRef = (ref: WizardProps["machineRef"], machine: WizardMachine | null): void => {
  if (!ref) {
    return;
  }
  if (typeof ref === "function") {
    ref(machine as never);
    return;
  }
  (ref as React.MutableRefObject<WizardMachine | null>).current = machine;
};

const WizardComponent = <TContext extends JourneyJsonObject = JourneyEmpty>(
  props: WizardProps<TContext>
): React.ReactElement => {
  const {
    children,
    steps: stepsProp,
    context,
    startIndex,
    startStepId,
    header,
    footer,
    wrapper,
    fallback,
    onStepChange,
    onStepEnter,
    onStepLeave,
    onComplete,
    onError,
    persist,
    plugins,
    handlers,
    requireExplicitCompletion,
    machineRef
  } = props;

  if (children !== undefined && children !== null && stepsProp !== undefined) {
    throw new Error(
      "<Wizard> accepts either children (step elements) or the `steps` object prop — not both."
    );
  }
  if (startIndex !== undefined && startIndex !== 0 && startStepId !== undefined) {
    errorInDevelopment(
      "<Wizard> received both startIndex and startStepId; startStepId wins. Remove one."
    );
  }

  const steps: DerivedWizardStep[] =
    stepsProp !== undefined
      ? deriveStepsFromObject(stepsProp as unknown as Parameters<typeof deriveStepsFromObject>[0])
      : deriveStepsFromChildren(children);

  // Callback refs: subscriptions below stay stable across re-renders while
  // always seeing the latest callbacks.
  const callbacksRef = React.useRef({
    onStepChange,
    onStepEnter,
    onStepLeave,
    onComplete,
    onError
  });
  callbacksRef.current = { onStepChange, onStepEnter, onStepLeave, onComplete, onError };

  const machineConfigRef = React.useRef({
    context: (context ?? {}) as JourneyJsonObject,
    initial: startStepId,
    startIndex,
    persist,
    plugins,
    handlers,
    requireExplicitCompletion
  });

  // Machine ownership: lazy ref init so StrictMode's double render creates
  // exactly one machine (the useOwnedJourney pattern), with a re-render bump
  // when a dynamic step change transplants to a fresh machine.
  const machineRefInternal = React.useRef<WizardMachine | null>(null);
  if (machineRefInternal.current === null) {
    machineRefInternal.current = createWizardMachine(steps, machineConfigRef.current);
  }
  const machine = machineRefInternal.current;
  const [, forceRender] = React.useReducer((count: number) => count + 1, 0);

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

  // Dynamic/conditional steps: when the derived id list changes, transplant to
  // a fresh machine hydrated from the previous snapshot. Mandatory ids make
  // the transplant exact.
  const signature = stepListSignature(steps);
  const signatureRef = React.useRef(signature);
  const stepsRef = React.useRef(steps);
  stepsRef.current = steps;
  useSafeLayoutEffect(() => {
    if (signatureRef.current === signature) {
      return;
    }
    signatureRef.current = signature;
    const previousMachine = machineRefInternal.current;
    if (!previousMachine) {
      return;
    }
    const previousSnapshot = previousMachine.getSnapshot();
    const nextMachine = createWizardMachine(
      stepsRef.current,
      { ...machineConfigRef.current, context: previousSnapshot.context },
      deriveLinearTransplantSnapshot(
        previousSnapshot,
        stepsRef.current.map((step) => step.id)
      )
    );
    machineRefInternal.current = nextMachine;
    previousMachine.dispose();
    forceRender();
  }, [signature]);

  // Auto-start, imperative machineRef, and event wiring — per machine instance.
  useSafeLayoutEffect(() => {
    assignMachineRef(machineRef as WizardProps["machineRef"], machine);

    if (machine.getSnapshot().status === "idled") {
      machine.controls.start().catch((error: unknown) => {
        callbacksRef.current.onError?.(error, { phase: "start" });
      });
    }

    const unsubscribeEvents = machine.subscribeEvent((event) => {
      if (event.type === "transition.error") {
        callbacksRef.current.onError?.(event.error, {
          phase: event.transitionId === "next-interceptor" ? "step-handler" : "navigate"
        });
      } else if (event.type === "step.enter") {
        callbacksRef.current.onStepEnter?.({
          stepId: event.stepId,
          context: machine.getSnapshot().context as TContext
        });
      } else if (event.type === "step.exit") {
        callbacksRef.current.onStepLeave?.({
          stepId: event.stepId,
          context: machine.getSnapshot().context as TContext
        });
      } else if (event.type === "journey.completed") {
        const snapshot = machine.getSnapshot() as LinearJourneySnapshot<TContext, string>;
        callbacksRef.current.onComplete?.({ context: snapshot.context, snapshot });
      }
    });

    const unsubscribeStepChange = machine.subscribeSelector(
      (snapshot) => snapshot.currentStepId,
      (toStepId, fromStepId) => {
        const snapshot = machine.getSnapshot();
        const fromIndex = fromStepId === undefined ? -1 : snapshot.stepOrder.indexOf(fromStepId);
        const toIndex = snapshot.stepOrder.indexOf(toStepId);
        const change: WizardStepChange<TContext> = {
          fromStepId: fromStepId ?? null,
          toStepId,
          fromIndex: fromIndex === -1 ? null : fromIndex,
          toIndex,
          direction:
            fromIndex === -1 || toIndex === fromIndex + 1
              ? "forward"
              : toIndex < fromIndex
                ? "backward"
                : "jump",
          context: snapshot.context as TContext
        };
        callbacksRef.current.onStepChange?.(change);
      }
    );

    return () => {
      unsubscribeEvents();
      unsubscribeStepChange();
      assignMachineRef(machineRef as WizardProps["machineRef"], null);
    };
    // machineRef identity changes are deliberately not resubscribed on.
  }, [machine]);

  const contextValue = React.useMemo<WizardContextValue>(
    () => ({
      machine,
      onError: (error, info) => callbacksRef.current.onError?.(error, info)
    }),
    [machine]
  );

  const snapshot = useJourneySnapshot(machine);
  const activeStep = steps.find((step) => step.id === snapshot.currentStepId);

  // With persistence configured, the pre-start render is deliberately the
  // fallback: server and client then render identically until the client-side
  // rehydration lands, avoiding hydration mismatches.
  const awaitingRehydration = persist !== undefined && snapshot.status === "idled";

  let activeNode: React.ReactNode;
  if (!awaitingRehydration && activeStep) {
    const stepContent =
      activeStep.element ??
      (activeStep.component ? React.createElement(activeStep.component) : null);
    activeNode = (
      <WizardActiveStepContext.Provider key={activeStep.id} value={activeStep.id}>
        {stepContent}
      </WizardActiveStepContext.Provider>
    );
  } else {
    activeNode = fallback ?? null;
  }

  const wrappedNode = wrapper ? React.cloneElement(wrapper, undefined, activeNode) : activeNode;

  return (
    <WizardContext.Provider value={contextValue}>
      {header}
      {wrappedNode}
      {footer}
    </WizardContext.Provider>
  );
};

type WizardComponentType = (<TContext extends JourneyJsonObject = JourneyEmpty>(
  props: WizardProps<TContext>
) => React.ReactElement) & {
  Step: typeof WizardStep;
};

/**
 * The linear wizard. Steps are components — as children (each with a
 * mandatory unique `id`, via an `id` prop or a `<Wizard.Step id>` wrapper) or
 * as a `steps` object (keys are ids, insertion order is step order).
 *
 * ```tsx
 * <Wizard header={<Progress />} footer={<Nav />}>
 *   <Email id="email" />
 *   <Password id="password" />
 *   <Confirm id="confirm" />
 * </Wizard>
 * ```
 *
 * No factory, no views map, no provider, no dispose: the machine is created
 * when `<Wizard>` mounts (StrictMode-safe) and disposed on unmount. Inside any
 * step, header, or footer, call `useWizard()`.
 */
export const Wizard: WizardComponentType = /*#__PURE__*/ Object.assign(WizardComponent, {
  Step: WizardStep
}) as WizardComponentType;
