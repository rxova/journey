import React from "react";
import { useJourneySnapshot } from "../headless/use-journey-snapshot";
import { useLinearJourneyContext } from "./linear-context";
import type { NavigationResult, NavigationWork } from "@rxova/journey-core";
import type {
  UseLinearJourneyResult,
  LinearJourneyMachine,
  LinearJourneySnapshot
} from "./linear.types";

/**
 * The linear journey hook — a thin React binding over the core linear runtime:
 * position, visits, and loading come straight off the snapshot; navigation
 * methods are the machine's own, except `goToNextStep`, which supplies the
 * active step's registered `useLinearJourneyStep` work to Core.
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

  const navigation = React.useMemo(() => {
    const goToNextStep = <TResult = void>(
      work?: NavigationWork<TContext, TStepId, LinearJourneySnapshot<TContext, TStepId>, TResult>
    ): Promise<NavigationResult<TStepId>> => {
      const currentId = machine.getSnapshot().currentStep?.id;
      const registered = currentId === undefined ? undefined : interceptors.get(currentId);
      return machine.navigate.goToNextStep((work ?? registered) as never) as Promise<
        NavigationResult<TStepId>
      >;
    };
    return {
      goToNextStep,
      goToPreviousStep: <TResult = void>(
        stepsOrWork?:
          | number
          | NavigationWork<TContext, TStepId, LinearJourneySnapshot<TContext, TStepId>, TResult>,
        work?: NavigationWork<TContext, TStepId, LinearJourneySnapshot<TContext, TStepId>, TResult>
      ) =>
        machine.navigate.goToPreviousStep(stepsOrWork as never, work as never) as Promise<
          NavigationResult<TStepId>
        >,
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
      clearError: machine.async.clearError
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
    isLoading: snapshot.machine.isLoading,
    isPaused: snapshot.machine.isPaused,
    error: currentStep.async.error,
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
