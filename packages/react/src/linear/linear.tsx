import React from "react";
import { createLinearJourney } from "@rxova/journey-core";
import { errorInDevelopment } from "@rxova/journey-common/dev";
import { useJourneySnapshot } from "../headless/use-journey-snapshot";
import { deriveStepsFromChildren, deriveStepsFromObject } from "./derive-steps";
import {
  buildLinearSteps,
  buildPersistPlugin,
  createInterceptorStore,
  stepListSignature
} from "./linear.helpers";
import { LinearJourneyActiveStepContext, LinearJourneyContext } from "./linear-context";
import { LinearJourneyStep } from "./linear-journey-step";
import type { DerivedLinearJourneyStep } from "./derive-steps";
import type { InterceptorStore } from "./linear.helpers";
import type { LinearJourneyContextValue } from "./linear-context";
import type {
  LinearJourneyMachine,
  LinearJourneyProps,
  LinearJourneySnapshot,
  LinearJourneyStepChange
} from "./linear.types";

const useSafeLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

const assignMachineRef = <TContext,>(
  ref: LinearJourneyProps<TContext>["machineRef"],
  machine: LinearJourneyMachine<TContext> | null
): void => {
  if (!ref) {
    return;
  }
  if (typeof ref === "function") {
    ref(machine as never);
    return;
  }
  (ref as React.MutableRefObject<LinearJourneyMachine<TContext> | null>).current = machine;
};

type LinearJourneyMachineSetup = {
  machine: LinearJourneyMachine;
  interceptors: InterceptorStore;
};

/**
 * Creates and starts the linear journey machine. `autoStart` in the creation options
 * means the first snapshot already has a current step — the linear journey never
 * renders an idle frame. A non-default start position is one ungated
 * `goToStepById` immediately after start (step 0's hooks still fire).
 */
const createLinearJourneyMachine = (
  steps: readonly DerivedLinearJourneyStep[],
  props: {
    context: unknown;
    startStepId?: string | undefined;
    startIndex?: number | undefined;
    persist?: LinearJourneyProps["persist"];
    plugins?: LinearJourneyProps["plugins"];
  },
  onError: (error: unknown, info: { phase: "start" | "navigate" | "step-handler" }) => void
): LinearJourneyMachineSetup => {
  const machine = createLinearJourney(
    { steps: buildLinearSteps(steps) as never, context: props.context ?? {} },
    {
      autoStart: true,
      plugins: [
        ...(props.persist ? [buildPersistPlugin(props.persist)] : []),
        ...(props.plugins ?? [])
      ]
    }
  ) as unknown as LinearJourneyMachine;

  const startTarget =
    props.startStepId ??
    (props.startIndex !== undefined && props.startIndex !== 0
      ? steps[props.startIndex]?.id
      : undefined);
  if (startTarget !== undefined && startTarget !== steps[0]?.id) {
    // Deferred a macrotask: the initial entry's effects are still settling
    // synchronously after creation, and navigation during that window is
    // rejected as "transitioning".
    setTimeout(() => {
      void machine.navigate.goToStepById(startTarget).then((result) => {
        if (!result.ok) {
          onError(
            "error" in result && result.error !== undefined
              ? result.error
              : new Error(`linear journey start navigation rejected: ${result.reason}`),
            { phase: "start" }
          );
        }
      });
    }, 0);
  }

  const interceptors = createInterceptorStore((error) => onError(error, { phase: "step-handler" }));
  return { machine, interceptors };
};

const LinearJourneyComponent = <TContext,>(
  props: LinearJourneyProps<TContext>
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
    machineRef
  } = props;

  if (children !== undefined && children !== null && stepsProp !== undefined) {
    throw new Error(
      "<LinearJourney> accepts either children (step elements) or the `steps` object prop — not both."
    );
  }
  if (startIndex !== undefined && startIndex !== 0 && startStepId !== undefined) {
    errorInDevelopment(
      "<LinearJourney> received both startIndex and startStepId; startStepId wins. Remove one."
    );
  }

  const steps: DerivedLinearJourneyStep[] =
    stepsProp !== undefined
      ? deriveStepsFromObject(stepsProp as never)
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
  const reportError = React.useCallback(
    (error: unknown, info: { phase: "start" | "navigate" | "step-handler" }) => {
      callbacksRef.current.onError?.(error, info);
    },
    []
  );

  const machineConfigRef = React.useRef({
    context: (context ?? {}) as unknown,
    startStepId,
    startIndex,
    persist,
    plugins
  });

  // Machine ownership: lazy ref init so StrictMode's double render creates
  // exactly one machine, with a re-render bump when a dynamic step change
  // swaps in a fresh machine.
  const setupRef = React.useRef<LinearJourneyMachineSetup | null>(null);
  if (setupRef.current === null) {
    setupRef.current = createLinearJourneyMachine(steps, machineConfigRef.current, reportError);
  }
  const { machine, interceptors } = setupRef.current;
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
        setupRef.current?.machine.dispose();
        setupRef.current = null;
      }, 0);
    };
  }, []);

  // Dynamic/conditional steps: when the derived id list changes, swap to a
  // fresh machine carrying the current context, re-entering the current step
  // when it still exists. (Timeline history restarts — the rewritten core has
  // no snapshot rehydration yet.)
  const signature = stepListSignature(steps);
  const signatureRef = React.useRef(signature);
  const stepsRef = React.useRef(steps);
  stepsRef.current = steps;
  useSafeLayoutEffect(() => {
    if (signatureRef.current === signature) {
      return;
    }
    signatureRef.current = signature;
    // The effect only runs while mounted, so the setup ref is always live.
    const previous = setupRef.current as LinearJourneyMachineSetup;
    const previousSnapshot = previous.machine.getSnapshot();
    const currentId = previousSnapshot.currentStep?.id;
    const nextSteps = stepsRef.current;
    const next = createLinearJourneyMachine(
      nextSteps,
      {
        ...machineConfigRef.current,
        context: previousSnapshot.context,
        startStepId: nextSteps.some((step) => step.id === currentId) ? currentId : undefined,
        startIndex: undefined
      },
      reportError
    );
    setupRef.current = next;
    previous.machine.dispose();
    forceRender();
  }, [signature, reportError]);

  // Imperative machineRef and event wiring — per machine instance.
  useSafeLayoutEffect(() => {
    assignMachineRef(machineRef, machine as LinearJourneyMachine<TContext>);

    const subscriptions = machine.subscriptions;
    const unsubscribes = [
      subscriptions.subscribeEvent("stepEnter", ({ snapshot, from, to }) => {
        callbacksRef.current.onStepEnter?.({ stepId: to, context: snapshot.context as TContext });
        const order = snapshot.steps.stepOrder;
        const fromIndex = from === null ? -1 : order.indexOf(from);
        const toIndex = order.indexOf(to);
        const change: LinearJourneyStepChange<TContext> = {
          fromStepId: from,
          toStepId: to,
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
      }),
      subscriptions.subscribeEvent("stepLeave", ({ snapshot, from }) => {
        callbacksRef.current.onStepLeave?.({ stepId: from, context: snapshot.context as TContext });
      }),
      subscriptions.subscribeEvent("statusChange", ({ snapshot, current }) => {
        if (current === "completed") {
          callbacksRef.current.onComplete?.({
            context: snapshot.context as TContext,
            snapshot: snapshot as LinearJourneySnapshot<TContext>
          });
        }
      }),
      subscriptions.subscribeEvent("error", ({ error }) => {
        callbacksRef.current.onError?.(error, { phase: "navigate" });
      })
    ];

    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
      assignMachineRef(machineRef, null);
    };
    // machineRef identity changes are deliberately not resubscribed on.
  }, [machine]);

  // Keyed cache instead of useMemo: identity is stable per machine + step
  // list, and there is no ref-derived dependency for the hooks compiler to
  // distrust.
  const contextCacheRef = React.useRef<{
    machine: unknown;
    signature: string;
    value: LinearJourneyContextValue;
  } | null>(null);
  if (
    contextCacheRef.current === null ||
    contextCacheRef.current.machine !== machine ||
    contextCacheRef.current.signature !== signature
  ) {
    contextCacheRef.current = {
      machine,
      signature,
      value: {
        machine,
        interceptors,
        metaByStep: new Map(steps.map((step) => [step.id, step.config.meta])),
        onError: reportError
      }
    };
  }
  const contextValue = contextCacheRef.current.value;

  const snapshot = useJourneySnapshot(machine);
  const activeStep = steps.find((step) => step.id === snapshot.currentStep?.id);

  let activeNode: React.ReactNode;
  if (activeStep) {
    const stepContent =
      activeStep.element ??
      (activeStep.component ? React.createElement(activeStep.component) : null);
    activeNode = (
      <LinearJourneyActiveStepContext.Provider key={activeStep.id} value={activeStep.id}>
        {stepContent}
      </LinearJourneyActiveStepContext.Provider>
    );
  } else {
    activeNode = fallback ?? null;
  }

  const wrappedNode = wrapper ? React.cloneElement(wrapper, undefined, activeNode) : activeNode;

  return (
    <LinearJourneyContext.Provider value={contextValue}>
      {header}
      {wrappedNode}
      {footer}
    </LinearJourneyContext.Provider>
  );
};

type LinearJourneyComponentType = (<TContext = Record<string, never>>(
  props: LinearJourneyProps<TContext>
) => React.ReactElement) & {
  Step: typeof LinearJourneyStep;
};

/**
 * The linear journey tier. Steps are components — as children (each with a
 * mandatory unique `id`, via an `id` prop or a `<LinearJourney.Step id>` wrapper) or
 * as a `steps` object (keys are ids, insertion order is step order).
 *
 * ```tsx
 * <LinearJourney header={<Progress />} footer={<Nav />}>
 *   <Email id="email" />
 *   <Password id="password" />
 *   <Confirm id="confirm" />
 * </LinearJourney>
 * ```
 *
 * No factory, no views map, no provider, no dispose: the machine is created
 * when `<LinearJourney>` mounts (StrictMode-safe) and disposed on unmount. Inside any
 * step, header, or footer, call `useLinearJourney()`.
 */
export const LinearJourney: LinearJourneyComponentType = /*#__PURE__*/ Object.assign(
  LinearJourneyComponent,
  {
    Step: LinearJourneyStep
  }
) as LinearJourneyComponentType;
