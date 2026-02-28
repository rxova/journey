import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "edit" | "confirmExit";
type Event = "requestClose" | "terminateJourney";
type Ctx = { dirty: boolean };

export const confirmExitJourney: JourneyDefinition<Ctx, StepId, Event> = {
  initial: "edit",
  context: { dirty: false },
  steps: {
    edit: {},
    confirmExit: {}
  },
  transitions: [
    {
      from: "*",
      event: "requestClose",
      to: "confirmExit",
      when: ({ context }) => context.dirty
    },
    { from: "*", event: "terminateJourney" }
  ]
};

export const createConfirmExitMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(confirmExitJourney);
