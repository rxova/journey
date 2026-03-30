import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "one" | "two" | "three";
type Ctx = Record<string, never>;

export const simpleBackJourney: JourneyDefinition<Ctx, StepId> = {
  context: {},
  steps: {
    one: {},
    two: {},
    three: {}
  },
  transitions: ["one", "two", "three"]
};

export const createSimpleBackMachine = () => createJourneyMachine(simpleBackJourney);
