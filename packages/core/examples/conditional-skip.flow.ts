import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "optional" | "review";
type Ctx = { includeOptional: boolean };

export const conditionalSkipJourney: JourneyDefinition<Ctx, StepId> = {
  initial: "start",
  context: { includeOptional: false },
  steps: {
    start: {},
    optional: {},
    review: {}
  },
  transitions: {
    start: {
      goToNextStep: [
        { to: "optional", when: ({ context }) => context.includeOptional },
        { to: "review", when: ({ context }) => !context.includeOptional }
      ]
    },
    optional: { goToNextStep: [{ to: "review" }] },
    review: { completeJourney: [{}] }
  }
};

export const createConditionalSkipMachine = () => createJourneyMachine(conditionalSkipJourney);
