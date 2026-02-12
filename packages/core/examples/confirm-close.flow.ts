import {
  createJourneyMachine,
  JOURNEY_TERMINAL,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = "edit" | "confirmExit";
type Event = "close";
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
      event: "close",
      to: "confirmExit",
      when: ({ context }) => context.dirty
    },
    {
      from: "*",
      event: "close",
      to: JOURNEY_TERMINAL.CLOSE,
      when: ({ context }) => !context.dirty
    }
  ]
};

export const createConfirmExitMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(confirmExitJourney);
