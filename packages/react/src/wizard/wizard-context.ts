import React from "react";

import type { JourneyJsonObject, LinearJourneyMachine } from "@rxova/journey-core";
import type { WizardStepHandler } from "./types";

/**
 * Tiny external store for `useWizardStep` interception state. Handlers are a
 * transient React-layer registry (never machine state); pending/error are
 * subscribable so `useWizard()` re-renders while a handler runs.
 */
export type WizardStepGate = {
  handlers: Map<string, WizardStepHandler>;
  getState: () => { pending: boolean; error: unknown };
  setState: (next: { pending: boolean; error: unknown }) => void;
  subscribe: (listener: () => void) => () => void;
};

export const createWizardStepGate = (): WizardStepGate => {
  let state = { pending: false, error: null as unknown };
  const listeners = new Set<() => void>();
  return {
    handlers: new Map(),
    getState: () => state,
    setState: (next) => {
      state = next;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
};

export type WizardContextValue = {
  machine: LinearJourneyMachine<JourneyJsonObject, string>;
  gate: WizardStepGate;
  /**
   * Per-step entry counts for this wizard's lifetime (fed by journey.start /
   * step.enter / journey.reset). Backward navigation re-enters a step without
   * appending to the history timeline, so the timeline alone cannot count
   * visits — this map can.
   */
  visitCounts: Map<string, number>;
  onError:
    | ((error: unknown, info: { phase: "start" | "navigate" | "step-handler" }) => void)
    | undefined;
};

/** Subscribes a visit counter to a machine's observation events. */
export const attachVisitCounter = (
  machine: Pick<LinearJourneyMachine<JourneyJsonObject, string>, "subscribeEvent">,
  counts: Map<string, number>
): void => {
  machine.subscribeEvent((event) => {
    if (event.type === "journey.start" || event.type === "step.enter") {
      counts.set(event.stepId, (counts.get(event.stepId) ?? 0) + 1);
    } else if (event.type === "journey.reset") {
      counts.clear();
      counts.set(event.stepId, 1);
    }
  });
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
