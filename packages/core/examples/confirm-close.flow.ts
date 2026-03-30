import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "edit" | "confirmExit";
type EventMap = { requestClose: unknown };
type Ctx = { dirty: boolean };

export const confirmExitJourney: JourneyDefinition<Ctx, StepId, EventMap> = {
  initial: "edit",
  context: { dirty: false },
  steps: {
    edit: {},
    confirmExit: {}
  },
  transitions: {
    global: {
      requestClose: [
        {
          to: "confirmExit",
          when: ({ context }) => context.dirty
        }
      ],
      terminateJourney: [{}]
    }
  }
};

export const createConfirmExitMachine = () => createJourneyMachine(confirmExitJourney);
