import React from "react";
import { useLinearJourneyContext, LinearJourneyActiveStepContext } from "./linear-context";
import type { LinearJourneyStepHandler } from "./linear.types";

const useSafeLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/**
 * Registers a forward-navigation handler for the step component calling it —
 * the react-use-wizard `handleStep` equivalent.
 *
 * `useLinearJourney().goToNextStep()` awaits the handler first; a throw/reject
 * cancels the navigation and lands in `useLinearJourney().error`, and
 * `useLinearJourney().isLoading` is true while it runs. Forward-only: timeline moves
 * and `goToStepById` bypass it (guards belong in step `onLeave`).
 *
 * ```tsx
 * const Password = () => {
 *   useLinearJourneyStep(async ({ context, updateContext }) => {
 *     const ok = await validatePassword(context.password);
 *     if (!ok) throw new Error("Invalid password");
 *     updateContext((ctx) => ({ ...ctx, validatedAt: Date.now() }));
 *   });
 *   return <PasswordForm />;
 * };
 * ```
 */
export const useLinearJourneyStep = <TContext = unknown>(
  handler?: LinearJourneyStepHandler<TContext>
): void => {
  const { machine, interceptors } = useLinearJourneyContext("useLinearJourneyStep");
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
        ? () =>
            handlerRef.current?.({
              context: machine.getSnapshot().context as TContext,
              updateContext: (updater) =>
                machine.context.update(updater as (prev: unknown) => unknown)
            })
        : undefined
    );
  }, [machine, interceptors, stepId, hasHandler]);
};
