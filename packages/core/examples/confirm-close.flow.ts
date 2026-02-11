import {
  createJourneyMachine,
  JOURNEY_TERMINAL,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = "edit" | "confirmClose";
type Event = "close";
type Ctx = { dirty: boolean };

export const confirmCloseJourney: JourneyDefinition<Ctx, StepId, Event> = {
  initial: "edit",
  context: { dirty: false },
  steps: {
    edit: {},
    confirmClose: {}
  },
  transitions: [
    {
      from: "*",
      event: "close",
      to: "confirmClose",
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

export const createConfirmCloseMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(confirmCloseJourney);
