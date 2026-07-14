import { useJourneyEvent } from "./use-journey-event";
import type { AnyJourneyMachine, ContextOf, StepIdOf } from "./headless.types";

/** Runs callbacks when the machine enters or leaves the given step. */
export const useJourneyStepLifecycle = <TMachine extends AnyJourneyMachine>(
  machine: TMachine,
  stepId: StepIdOf<TMachine>,
  callbacks: {
    onEnter?: (args: { context: ContextOf<TMachine> }) => void;
    onLeave?: (args: { context: ContextOf<TMachine> }) => void;
  }
): void => {
  useJourneyEvent(machine, "stepEnter", (payload) => {
    if (payload.to === stepId) {
      callbacks.onEnter?.({ context: machine.getSnapshot().context as ContextOf<TMachine> });
    }
  });
  useJourneyEvent(machine, "stepLeave", (payload) => {
    if (payload.from === stepId) {
      callbacks.onLeave?.({ context: machine.getSnapshot().context as ContextOf<TMachine> });
    }
  });
};
