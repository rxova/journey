import React from "react";
import type { LinearJourneyMachine } from "./linear.types";

export const LinearJourneyMachineContext =
  /*#__PURE__*/ React.createContext<LinearJourneyMachine | null>(null);

/** Id of the step currently being rendered — lets `useLinearJourneyStep` know its owner. */
export const LinearJourneyActiveStepContext = /*#__PURE__*/ React.createContext<string | null>(
  null
);

export const useLinearJourneyMachine = (hookName: string): LinearJourneyMachine => {
  const machine = React.useContext(LinearJourneyMachineContext);
  if (machine === null) {
    throw new Error(
      `${hookName}() must be called inside a <LinearJourney> (or a bundle LinearJourney from createLinearJourney).`
    );
  }
  return machine;
};
