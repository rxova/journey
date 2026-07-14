import React from "react";
import type { InterceptorStore } from "./linear.helpers";
import type { LinearJourneyMachine } from "./linear.types";

export type LinearJourneyContextValue = {
  machine: LinearJourneyMachine;
  interceptors: InterceptorStore;
  /** Step id → authored meta, resolved by the LinearJourney from its step config. */
  metaByStep: ReadonlyMap<string, unknown>;
  onError:
    | ((error: unknown, info: { phase: "start" | "navigate" | "step-handler" }) => void)
    | undefined;
};

export const LinearJourneyContext =
  /*#__PURE__*/ React.createContext<LinearJourneyContextValue | null>(null);

/** Id of the step currently being rendered — lets `useLinearJourneyStep` know its owner. */
export const LinearJourneyActiveStepContext = /*#__PURE__*/ React.createContext<string | null>(
  null
);

export const useLinearJourneyContext = (hookName: string): LinearJourneyContextValue => {
  const value = React.useContext(LinearJourneyContext);
  if (value === null) {
    throw new Error(
      `${hookName}() must be called inside a <LinearJourney> (or a bundle LinearJourney from createLinearJourney).`
    );
  }
  return value;
};
