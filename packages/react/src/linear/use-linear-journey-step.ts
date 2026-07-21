import React from "react";
import { LinearJourneyActiveStepContext } from "./active-step-context";
import type { LinearJourneyMachine, LinearJourneyStepHandler } from "./linear.types";

const useSafeLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/**
 * Implementation behind every bundle's `journey.useStep()` — registers
 * forward-navigation work for the step component calling it, the
 * react-use-wizard `handleStep` equivalent, a shell over core's
 * `machine.navigate.registerNextStepInterceptor`.
 *
 * `machine.navigate.goToNextStep()` runs the registered work in Core; a
 * throw/reject cancels the navigation and lands in
 * `snapshot.currentStep.async.error`, with `snapshot.machine.isLoading` true
 * while it runs. Forward-only: timeline moves and `goToStepById` bypass it.
 * `onLeave` and `onEnter` remain post-commit effects.
 */
export const useLinearJourneyStep = <TContext, TResult = void>(
  machine: LinearJourneyMachine<TContext, string>,
  handler?: LinearJourneyStepHandler<TContext, TResult>
): void => {
  const stepId = React.useContext(LinearJourneyActiveStepContext);

  if (stepId === null) {
    throw new Error(
      "useStep() must be called from inside a step component rendered by the journey's <Provider> " +
        "(the Provider supplies the owning step's identity)."
    );
  }

  const handlerRef = React.useRef(handler);
  handlerRef.current = handler;

  const hasHandler = handler !== undefined;
  useSafeLayoutEffect(() => {
    if (!hasHandler) return;
    const work: LinearJourneyStepHandler<TContext, TResult> = {
      run: (args) => handlerRef.current?.run(args) as TResult | Promise<TResult>,
      commit: (args) => handlerRef.current?.commit?.(args)
    };
    return machine.navigate.registerNextStepInterceptor(stepId, work as never);
  }, [machine, stepId, hasHandler]);
};
