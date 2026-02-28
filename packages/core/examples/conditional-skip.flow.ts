import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "optional" | "review";
type Event = "goToNextStep" | "completeJourney";
type Ctx = { includeOptional: boolean };

export const conditionalSkipJourney: JourneyDefinition<Ctx, StepId, Event> = {
  initial: "start",
  context: { includeOptional: false },
  steps: {
    start: {},
    optional: {},
    review: {}
  },
  transitions: [
    {
      from: "start",
      event: "goToNextStep",
      to: "optional",
      when: ({ context }) => context.includeOptional
    },
    {
      from: "start",
      event: "goToNextStep",
      to: "review",
      when: ({ context }) => !context.includeOptional
    },
    { from: "optional", event: "goToNextStep", to: "review" },
    { from: "review", event: "completeJourney" }
  ]
};

export const createConditionalSkipMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(conditionalSkipJourney);
