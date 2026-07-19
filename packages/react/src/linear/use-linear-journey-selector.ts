import { useJourneySelector } from "../headless/use-journey-selector";
import { useLinearJourneyMachine } from "./machine-context";
import type { LinearJourneySnapshot } from "./linear.types";

/**
 * Subscribes to a derived slice of the enclosing linear journey's snapshot; the
 * component only re-renders when the selected value changes.
 */
export const useLinearJourneySelector = <
  TSelected,
  TContext = unknown,
  TStepId extends string = string
>(
  selector: (snapshot: LinearJourneySnapshot<TContext, TStepId>) => TSelected,
  equalityFn?: (a: TSelected, b: TSelected) => boolean
): TSelected => {
  const machine = useLinearJourneyMachine("useLinearJourneySelector");
  return useJourneySelector(
    machine,
    selector as (snapshot: ReturnType<typeof machine.getSnapshot>) => TSelected,
    equalityFn
  );
};
