import React from "react";

import { useJourneySelector, useJourneySnapshot } from "../headless/hooks";
import { useWizardContext } from "./wizard-context";

import type {
  JourneyEqualityFn,
  JourneyJsonObject,
  JourneySendResult,
  LinearJourneyMachine,
  LinearJourneySnapshot
} from "@rxova/journey-core";
import type { UseWizardResult } from "./types";

const useSafeLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/**
 * The wizard hook: position, visit tracking, status, navigation (existing
 * machine method names, verbatim), typed shared context, and per-step
 * metadata — bound to the enclosing `<Wizard>`.
 *
 * The generic parameter is an unchecked assertion (`useWizard<MyContext>()`),
 * the same trade react-use-wizard makes; fully inferred typing comes from
 * `createWizard()`.
 */
export const useWizard = <
  TContext extends JourneyJsonObject = JourneyJsonObject,
  TStepId extends string = string
>(): UseWizardResult<TContext, TStepId> => {
  const { machine, gate, visitCounts, onError } = useWizardContext("useWizard");
  const snapshot = useJourneySnapshot(machine) as LinearJourneySnapshot<TContext, TStepId>;
  const gateState = React.useSyncExternalStore(gate.subscribe, gate.getState, gate.getState);

  // isPaused is a transient machine flag outside the snapshot; observe it via
  // the journey.paused/journey.resumed observation events.
  const [isPaused, setIsPaused] = React.useState(() => machine.isPaused());
  useSafeLayoutEffect(() => {
    setIsPaused(machine.isPaused());
    return machine.subscribeEvent((event) => {
      if (event.type === "journey.paused") {
        setIsPaused(true);
      } else if (event.type === "journey.resumed") {
        setIsPaused(false);
      }
    });
  }, [machine]);

  const navigation = React.useMemo(() => {
    const runStepHandler = async (): Promise<{ ok: boolean; error?: unknown }> => {
      const activeStepId = machine.getSnapshot().currentStepId;
      const handler = gate.handlers.get(activeStepId);
      if (!handler) {
        return { ok: true };
      }

      gate.setState({ pending: true, error: null });
      try {
        await handler({
          context: machine.getSnapshot().context,
          updateContext: machine.updateContext
        });
      } catch (error) {
        gate.setState({ pending: false, error });
        onError?.(error, { phase: "step-handler" });
        return { ok: false, error };
      }
      gate.setState({ pending: false, error: null });
      return { ok: true };
    };

    const goToNextStep = async () => {
      const intercepted = await runStepHandler();
      if (!intercepted.ok) {
        return {
          transitioned: false,
          error: intercepted.error,
          snapshot: machine.getSnapshot()
        };
      }
      return machine.goToNextStep();
    };

    return {
      goToNextStep,
      goToPreviousStep: machine.goToPreviousStep,
      goToStepById: machine.goToStepById,
      goToStepByIndex: machine.goToStepByIndex,
      goToLastVisitedStep: machine.goToLastVisitedStep,
      completeJourney: machine.completeJourney,
      resetJourney: () => machine.resetJourney(),
      pauseJourney: machine.pauseJourney,
      resumeJourney: machine.resumeJourney,
      clearStepError: machine.clearStepError,
      updateContext: machine.updateContext
    };
  }, [machine, gate, onError]);

  const { stepOrder } = snapshot;
  const activeStepId = snapshot.currentStepId;
  const activeStepIndex = stepOrder.indexOf(activeStepId);
  const stepCount = stepOrder.length;

  // Normalize over the full step order so unvisited steps read as explicit
  // `false` instead of being absent from the map.
  const visited = React.useMemo(
    () =>
      Object.fromEntries(
        stepOrder.map((stepId) => [stepId, snapshot.visited[stepId] === true])
      ) as Record<TStepId, boolean>,
    [stepOrder, snapshot.visited]
  );

  // Backward navigation re-enters a step by moving the history index (no
  // timeline append), so first-visit detection combines the session entry
  // counter with timeline occurrences (which cover persisted history).
  let timelineOccurrences = 0;
  for (const stepId of snapshot.history.timeline) {
    if (stepId === activeStepId) {
      timelineOccurrences += 1;
    }
  }
  const sessionVisits = visitCounts.get(activeStepId) ?? 1;
  const isFirstTimeVisit = sessionVisits <= 1 && timelineOccurrences <= 1;

  const activeAsync = snapshot.async.byStep[activeStepId];

  return {
    activeStepId,
    activeStepIndex,
    stepCount,
    stepIds: stepOrder,
    isFirstStep: activeStepIndex === 0,
    isLastStep: activeStepIndex === stepCount - 1,

    visited,
    isFirstTimeVisit,

    status: snapshot.status,
    isLoading: gateState.pending || snapshot.async.isLoading,
    isPaused,
    error: gateState.error ?? activeAsync?.error ?? null,

    ...(navigation as unknown as Pick<
      UseWizardResult<TContext, TStepId>,
      | "goToNextStep"
      | "goToPreviousStep"
      | "goToStepById"
      | "goToStepByIndex"
      | "goToLastVisitedStep"
      | "completeJourney"
      | "resetJourney"
      | "pauseJourney"
      | "resumeJourney"
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

export type WizardNavigationResult<
  TContext extends JourneyJsonObject,
  TStepId extends string
> = JourneySendResult<TContext, TStepId>;
