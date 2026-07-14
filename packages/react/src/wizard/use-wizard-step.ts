import React from "react";

import { useWizardContext, WizardActiveStepContext } from "./wizard-context";

import type { JourneyJsonObject } from "@rxova/journey-core";
import type { WizardStepHandler } from "./types";

const useSafeLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/**
 * Registers a forward-navigation interceptor for the step component calling
 * it — the react-use-wizard `handleStep` equivalent.
 *
 * This is a thin binding over the core linear runtime's
 * `registerNextStepInterceptor`: `goToNextStep()` awaits the handler first, a
 * throw/reject cancels the navigation and lands in `useWizard().error`, and
 * `useWizard().isLoading` is true while it runs (the step's async state
 * reports the `evaluating-when` phase). Forward-only.
 *
 * ```tsx
 * const Password = () => {
 *   useWizardStep(async ({ context, updateContext }) => {
 *     const ok = await validatePassword(context.password);
 *     if (!ok) throw new Error("Invalid password");
 *     await updateContext((ctx) => ({ ...ctx, validatedAt: Date.now() }));
 *   });
 *   return <PasswordForm />;
 * };
 * ```
 */
export const useWizardStep = <TContext extends JourneyJsonObject = JourneyJsonObject>(
  handler?: WizardStepHandler<TContext>
): void => {
  const { machine } = useWizardContext("useWizardStep");
  const stepId = React.useContext(WizardActiveStepContext);

  if (stepId === null) {
    throw new Error(
      "useWizardStep() must be called from inside a step component rendered by <Wizard> " +
        "(the wizard provides the owning step's identity)."
    );
  }

  const handlerRef = React.useRef(handler);
  handlerRef.current = handler;

  useSafeLayoutEffect(() => {
    return machine.registerNextStepInterceptor(stepId, (args) =>
      handlerRef.current?.(args as never)
    );
  }, [machine, stepId]);
};
