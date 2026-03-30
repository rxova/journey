import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "one" | "two" | "three";
type Ctx = { name: string };

export const simpleJourney: JourneyDefinition<Ctx, StepId> = {
  context: { name: "" },
  steps: {
    one: {},
    two: {},
    three: {}
  },
  transitions: ["one", "two", "three"]
};

export const createSimpleJourneyMachine = () => createJourneyMachine(simpleJourney);
