import { useJourneySnapshot } from "../headless/use-journey-snapshot";
import { useLinearJourneyMachine } from "./machine-context";
import type {
  LinearJourneyMachine,
  LinearJourneySnapshot,
  UseLinearJourneyResult
} from "./linear.types";

/**
 * The linear journey hook — the core machine and its live snapshot, verbatim.
 * Navigation is `machine.navigate.*`, lifecycle is `machine.controls.*`, and
 * every read is a snapshot field (`snapshot.currentStep.isFirstStep`, …).
 *
 * The generic parameter is an unchecked assertion (`useLinearJourney<MyContext>()`);
 * fully inferred typing comes from `createLinearJourney()`.
 */
export const useLinearJourney = <
  TContext = unknown,
  TStepId extends string = string
>(): UseLinearJourneyResult<TContext, TStepId> => {
  const machine = useLinearJourneyMachine("useLinearJourney");
  const snapshot = useJourneySnapshot(machine) as LinearJourneySnapshot<TContext, TStepId>;
  return { machine: machine as LinearJourneyMachine<TContext, TStepId>, snapshot };
};
