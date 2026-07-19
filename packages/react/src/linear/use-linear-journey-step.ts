import React from "react";
import { useLinearJourneyMachine, LinearJourneyActiveStepContext } from "./machine-context";
import type { LinearJourneyStepHandler } from "./linear.types";

const useSafeLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/**
 * Registers forward-navigation work for the step component calling it —
 * the react-use-wizard `handleStep` equivalent, a shell over core's
 * `machine.navigate.registerNextStepInterceptor`.
 *
 * `machine.navigate.goToNextStep()` runs the registered work in Core; a
 * throw/reject cancels the navigation and lands in
 * `snapshot.currentStep.async.error`, with `snapshot.machine.isLoading` true
 * while it runs. Forward-only: timeline moves and `goToStepById` bypass it.
 * `onLeave` and `onEnter` remain post-commit effects.
 *
 * ```tsx
 * const Password = () => {
 *   useLinearJourneyStep({
 *     run: async ({ snapshot }) => validatePassword(snapshot.context.password),
 *     commit: ({ result, updateContext }) => {
 *       if (!result) throw new Error("Invalid password");
 *       updateContext((ctx) => ({ ...ctx, password: "" }));
 *     }
 *   });
 *   return <PasswordForm />;
 * };
 * ```
 */
export const useLinearJourneyStep = <TContext = unknown, TResult = void>(
  handler?: LinearJourneyStepHandler<TContext, TResult>
): void => {
  const machine = useLinearJourneyMachine("useLinearJourneyStep");
  const stepId = React.useContext(LinearJourneyActiveStepContext);

  if (stepId === null) {
    throw new Error(
      "useLinearJourneyStep() must be called from inside a step component rendered by <LinearJourney> " +
        "(the linear journey provides the owning step's identity)."
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
