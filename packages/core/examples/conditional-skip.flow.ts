import {
  createJourneyMachine,
  JOURNEY_TERMINAL,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = "start" | "optional" | "review";
type Event = "next" | "submit";
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
      event: "next",
      to: "optional",
      when: ({ context }) => context.includeOptional
    },
    {
      from: "start",
      event: "next",
      to: "review",
      when: ({ context }) => !context.includeOptional
    },
    { from: "optional", event: "next", to: "review" },
    { from: "review", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};

export const createConditionalSkipMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(conditionalSkipJourney);
