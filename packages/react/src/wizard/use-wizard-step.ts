import React from "react";

import { useWizardContext, WizardActiveStepContext } from "./wizard-context";

import type { JourneyJsonObject } from "@rxova/journey-core";
import type { WizardStepHandler } from "./types";

const useSafeLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/**
 * Registers a forward-navigation interceptor for the step component calling
 * it — the react-use-wizard `handleStep` equivalent.
 *
 * When the user calls `goToNextStep()`, the handler is awaited first: a
 * throw/reject cancels the navigation and lands in `useWizard().error`, and
 * `useWizard().isLoading` is true while it runs. Forward-only — backward
 * navigation and jumps are never intercepted.
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
 *
 * Purely React-layer state (a transient handler registry) — layered on top of,
 * not instead of, core `effect`/`onLeave`.
 */
export const useWizardStep = <TContext extends JourneyJsonObject = JourneyJsonObject>(
  handler?: WizardStepHandler<TContext>
): void => {
  const { gate } = useWizardContext("useWizardStep");
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
    gate.handlers.set(stepId, (args) => handlerRef.current?.(args as never));
    return () => {
      gate.handlers.delete(stepId);
    };
  }, [gate, stepId]);
};
