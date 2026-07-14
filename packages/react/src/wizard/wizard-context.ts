import React from "react";

import type { JourneyJsonObject, LinearJourneyMachine } from "@rxova/journey-core";

export type WizardContextValue = {
  machine: LinearJourneyMachine<JourneyJsonObject, string>;
  onError:
    | ((error: unknown, info: { phase: "start" | "navigate" | "step-handler" }) => void)
    | undefined;
};

export const WizardContext = /*#__PURE__*/ React.createContext<WizardContextValue | null>(null);

/** Id of the step currently being rendered — lets `useWizardStep` know its owner. */
export const WizardActiveStepContext = /*#__PURE__*/ React.createContext<string | null>(null);

export const useWizardContext = (hookName: string): WizardContextValue => {
  const value = React.useContext(WizardContext);
  if (value === null) {
    throw new Error(
      `${hookName}() must be called inside a <Wizard> (or a bundle Wizard from createWizard).`
    );
  }
  return value;
};
