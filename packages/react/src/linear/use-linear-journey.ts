import React from "react";
import { useJourneySnapshot } from "../headless/use-journey-snapshot";
import { useLinearJourneyContext } from "./linear-context";
import type { NavigationResult } from "@rxova/journey-core";
import type {
  UseLinearJourneyResult,
  LinearJourneyMachine,
  LinearJourneySnapshot
} from "./linear.types";

/**
 * The linear journey hook — a thin React binding over the core linear runtime:
 * position, visits, and loading come straight off the snapshot; navigation
 * methods are the machine's own, except `goToNextStep`, which awaits the
 * active step's `useLinearJourneyStep` handler first.
 *
 * The generic parameter is an unchecked assertion (`useLinearJourney<MyContext>()`);
 * fully inferred typing comes from `createLinearJourney()`.
 */
export const useLinearJourney = <
  TContext = unknown,
  TStepId extends string = string
>(): UseLinearJourneyResult<TContext, TStepId> => {
  const { machine, interceptors, metaByStep } = useLinearJourneyContext("useLinearJourney");
  const snapshot = useJourneySnapshot(machine) as LinearJourneySnapshot<TContext, TStepId>;

  const interceptorState = React.useSyncExternalStore(
    interceptors.subscribe,
    interceptors.getState,
    interceptors.getState
  );

  const navigation = React.useMemo(() => {
    const goToNextStep = async (): Promise<NavigationResult<TStepId>> => {
      const currentId = machine.getSnapshot().currentStep?.id;
      if (currentId !== undefined && !(await interceptors.run(currentId))) {
        return { ok: false, reason: "blocked" };
      }
      return machine.navigate.goToNextStep() as Promise<NavigationResult<TStepId>>;
    };
    return {
      goToNextStep,
      goToPreviousStep: (steps?: number) =>
        machine.navigate.goToPreviousStep(steps) as Promise<NavigationResult<TStepId>>,
      goToStepById: (stepId: TStepId) =>
        machine.navigate.goToStepById(stepId) as Promise<NavigationResult<TStepId>>,
      goToStepByIndex: (index: number) => {
        const target = machine.getSnapshot().steps.stepOrder[index];
        if (target === undefined) {
          return Promise.resolve({
            ok: false as const,
            reason: "invalid-target" as const
          }) as Promise<NavigationResult<TStepId>>;
        }
        return machine.navigate.goToStepById(target) as Promise<NavigationResult<TStepId>>;
      },
      goToLastVisitedStep: () =>
        machine.navigate.goToLastVisitedStep() as Promise<NavigationResult<TStepId>>,
      controls: machine.controls,
      updateContext: (updater: (context: TContext) => TContext) =>
        machine.context.update(updater as (previous: unknown) => unknown),
      clearError: interceptors.clearError
    };
  }, [machine, interceptors]);

  // Invariant: linear journey machines are created with autoStart, and terminated or
  // completed machines keep their last step — currentStep is never null here.
  const currentStep = snapshot.currentStep as NonNullable<typeof snapshot.currentStep>;

  return {
    activeStepId: currentStep.id as TStepId,
    activeStepIndex: currentStep.index,
    stepCount: snapshot.steps.totalSteps,
    stepIds: snapshot.steps.stepOrder as readonly TStepId[],
    isFirstStep: currentStep.isFirstStep,
    isLastStep: currentStep.isLastStep,

    visited: snapshot.history.visited as Readonly<Record<TStepId, boolean>>,
    isStepFirstTimeVisit: currentStep.isFirstTimeVisit,

    status: snapshot.status,
    isLoading: snapshot.machine.isLoading || interceptorState.pending,
    isPaused: snapshot.machine.isPaused,
    error: interceptorState.error ?? currentStep.async.error,
    clearError: navigation.clearError,

    goToNextStep: navigation.goToNextStep,
    goToPreviousStep: navigation.goToPreviousStep,
    goToStepById: navigation.goToStepById,
    goToStepByIndex: navigation.goToStepByIndex,
    goToLastVisitedStep: navigation.goToLastVisitedStep,
    controls: navigation.controls,

    context: snapshot.context,
    updateContext: navigation.updateContext,

    activeStepMeta: metaByStep.get(currentStep.id),
    getStepMeta: (stepId: TStepId) => metaByStep.get(stepId),

    snapshot,
    machine: machine as LinearJourneyMachine<TContext>
  };
};
