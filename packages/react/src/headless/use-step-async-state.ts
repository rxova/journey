import { useJourneySelector } from "./use-journey-selector";
import type { StepAsyncState } from "@rxova/journey-core";
import type { AnyJourneyMachine, StepIdOf } from "./headless.types";

const IDLE_STEP_ASYNC_STATE: StepAsyncState = Object.freeze({
  isLoading: false,
  isSuccess: false,
  isError: false,
  error: null
});

const isSameStepAsyncState = (a: StepAsyncState, b: StepAsyncState): boolean =>
  a.isLoading === b.isLoading &&
  a.isSuccess === b.isSuccess &&
  a.isError === b.isError &&
  Object.is(a.error, b.error);

/**
 * Subscribes to a step's `onEnter` async state. The core tracks async state
 * for the current step only, so other steps report the idle state.
 */
export const useStepAsyncState = <TMachine extends AnyJourneyMachine>(
  machine: TMachine,
  stepId: StepIdOf<TMachine>
): StepAsyncState =>
  useJourneySelector(
    machine,
    (snapshot) => {
      const current = (snapshot as { currentStep: { id: string; async: StepAsyncState } | null })
        .currentStep;
      return current?.id === stepId ? current.async : IDLE_STEP_ASYNC_STATE;
    },
    isSameStepAsyncState
  );
