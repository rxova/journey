import React from "react";
import { createLinearJourney } from "@rxova/journey-core";
import { errorInDevelopment } from "@rxova/journey-common/dev";
import { useJourneySnapshot } from "../headless/use-journey-snapshot";
import { deriveStepsFromChildren } from "./derive-steps";
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
  contextValue: LinearJourneyContextValue;
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
    { steps: buildLinearSteps(steps) as never, context: props.context },
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
  return {
    machine,
    interceptors,
    contextValue: {
      machine,
      interceptors,
      metaByStep: new Map(steps.map((step) => [step.id, step.config.meta])),
      onError
    }
  };
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
    startStepId,
    header,
    footer,
    wrapper,
    fallback,
    onStart,
    onStepChange,
    onStepEnter,
    onStepLeave,
    onComplete,
    onError,
    persist,
    plugins,
    machineRef,
    declaredStepIds
  } = props;

  if (startIndex !== undefined && startIndex !== 0 && startStepId !== undefined) {
    errorInDevelopment(
      "<LinearJourney> received both startIndex and startStepId; startStepId wins. Remove one."
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
  const callbacksRef = React.useRef({
    onStart,
    onStepChange,
    onStepEnter,
    onStepLeave,
    onComplete,
    onError
  });
  callbacksRef.current = { onStart, onStepChange, onStepEnter, onStepLeave, onComplete, onError };
  const reportError = React.useCallback(
    (error: unknown, info: { phase: "start" | "navigate" | "step-handler" }) => {
      callbacksRef.current.onError?.(error, info);
    },
    []
  );

  // Machine ownership: lazy ref init so StrictMode's double render creates
  // exactly one machine. Machine, interceptors, and the provided context value
  // are all fixed for the lifetime of the mount.
  const setupRef = React.useRef<LinearJourneyMachineSetup | null>(null);
  if (setupRef.current === null) {
    setupRef.current = createLinearJourneyMachine(
      steps,
      { context: (context ?? {}) as unknown, startStepId, startIndex, persist, plugins },
      reportError
    );
  }
  const { machine, contextValue } = setupRef.current;

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

  // Imperative machineRef, onStart, and event wiring.
  const startReportedRef = React.useRef(false);
  useSafeLayoutEffect(() => {
    assignMachineRef(machineRef, machine as LinearJourneyMachine<TContext>);

    // Once per mounted journey (the ref guard absorbs StrictMode's double
    // effect). With a non-default start position this reports step 0; the
    // deferred start navigation lands via onStepChange right after.
    if (!startReportedRef.current) {
      startReportedRef.current = true;
      const startSnapshot = machine.getSnapshot();
      if (startSnapshot.currentStep !== null) {
        callbacksRef.current.onStart?.({
          stepId: startSnapshot.currentStep.id,
          context: startSnapshot.context as TContext
        });
      }
    }

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
