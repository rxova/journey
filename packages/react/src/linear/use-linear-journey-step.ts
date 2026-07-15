import React from "react";
import { useLinearJourneyContext, LinearJourneyActiveStepContext } from "./linear-context";
import type { LinearJourneyStepHandler } from "./linear.types";

const useSafeLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/**
 * Registers forward-navigation work for the step component calling it —
 * the react-use-wizard `handleStep` equivalent.
 *
 * `useLinearJourney().goToNextStep()` delegates the work to Core; a throw/reject
 * cancels the navigation and lands in `useLinearJourney().error`, and
 * `useLinearJourney().isLoading` is true while it runs. Forward-only: timeline moves
 * and `goToStepById` bypass it. `onLeave` and `onEnter` remain post-commit effects.
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
  const { interceptors } = useLinearJourneyContext("useLinearJourneyStep");
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
    return interceptors.register(
      stepId,
      hasHandler
        ? ({
            run: (args: never) => handlerRef.current?.run(args),
            commit: (args: never) => handlerRef.current?.commit?.(args)
          } as never)
        : undefined
    );
  }, [interceptors, stepId, hasHandler]);
};
