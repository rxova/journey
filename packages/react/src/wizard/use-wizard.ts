import React from "react";

import { useJourneySelector, useJourneySnapshot } from "../headless/hooks";
import { useWizardContext } from "./wizard-context";

import type {
  JourneyEqualityFn,
  JourneyJsonObject,
  JourneyLinearComputed,
  LinearJourneyMachine,
  LinearJourneySnapshot
} from "@rxova/journey-core";
import type { UseWizardResult } from "./types";

const useSafeLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/**
 * The wizard hook — a thin React binding over the core linear runtime:
 * position and visit tracking come from `getComputed()`, loading/error from
 * the machine's async state, navigation methods are the machine's own.
 *
 * The generic parameter is an unchecked assertion (`useWizard<MyContext>()`),
 * the same trade react-use-wizard makes; fully inferred typing comes from
 * `createWizard()`.
 */
export const useWizard = <
  TContext extends JourneyJsonObject = JourneyJsonObject,
  TStepId extends string = string
>(): UseWizardResult<TContext, TStepId> => {
  const { machine } = useWizardContext("useWizard");
  const snapshot = useJourneySnapshot(machine) as LinearJourneySnapshot<TContext, TStepId>;
  const computed = React.useMemo(() => {
    void snapshot;
    return machine.getComputed() as JourneyLinearComputed<TStepId>;
  }, [machine, snapshot]);

  // isPaused is a transient machine flag outside the snapshot; observe it via
  // the journey.paused/journey.resumed observation events.
  const [isPaused, setIsPaused] = React.useState(() => machine.controls.isPaused());
  useSafeLayoutEffect(() => {
    setIsPaused(machine.controls.isPaused());
    return machine.subscribeEvent((event) => {
      if (event.type === "journey.paused") {
        setIsPaused(true);
      } else if (event.type === "journey.resumed") {
        setIsPaused(false);
      }
    });
  }, [machine]);

  const navigation = React.useMemo(
    () => ({
      goToNextStep: machine.goToNextStep,
      goToPreviousStep: machine.goToPreviousStep,
      goToStepById: machine.goToStepById,
      goToStepByIndex: machine.goToStepByIndex,
      goToLastVisitedStep: machine.goToLastVisitedStep,
      controls: machine.controls,
      clearStepError: machine.clearStepError,
      updateContext: machine.updateContext
    }),
    [machine]
  );

  const activeStepId = snapshot.currentStepId;
  const activeAsync = snapshot.async.byStep[activeStepId];

  return {
    activeStepId,
    activeStepIndex: computed.activeStepIndex,
    stepCount: computed.stepCount,
    stepIds: computed.stepOrder,
    isFirstStep: computed.isFirstStep,
    isLastStep: computed.isLastStep,

    visited: snapshot.visited,
    isStepFirstTimeVisit: computed.isStepFirstTimeVisit,

    status: snapshot.status,
    isLoading: snapshot.async.isLoading,
    isPaused,
    error: activeAsync?.error ?? null,

    ...(navigation as unknown as Pick<
      UseWizardResult<TContext, TStepId>,
      | "goToNextStep"
      | "goToPreviousStep"
      | "goToStepById"
      | "goToStepByIndex"
      | "goToLastVisitedStep"
      | "controls"
      | "clearStepError"
      | "updateContext"
    >),

    context: snapshot.context,

    activeStepMeta: machine.getStepMeta(activeStepId) as UseWizardResult<
      TContext,
      TStepId
    >["activeStepMeta"],
    getStepMeta: ((stepId: TStepId) => machine.getStepMeta(stepId)) as UseWizardResult<
      TContext,
      TStepId
    >["getStepMeta"],

    snapshot,
    machine: machine as unknown as LinearJourneyMachine<TContext, TStepId>
  };
};

/**
 * Subscribes to a derived slice of the enclosing wizard's snapshot; the
 * component only re-renders when the selected value changes.
 */
export const useWizardSelector = <
  TSelected,
  TContext extends JourneyJsonObject = JourneyJsonObject,
  TStepId extends string = string
>(
  selector: (snapshot: LinearJourneySnapshot<TContext, TStepId>) => TSelected,
  equalityFn?: JourneyEqualityFn<TSelected>
): TSelected => {
  const { machine } = useWizardContext("useWizardSelector");
  return useJourneySelector(
    machine,
    selector as (snapshot: ReturnType<typeof machine.getSnapshot>) => TSelected,
    equalityFn
  );
};
