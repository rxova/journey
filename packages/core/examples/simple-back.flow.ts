import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "one" | "two" | "three";
type Event = "goToNextStep" | "back";
type Ctx = Record<string, never>;

export const simpleBackJourney: JourneyDefinition<Ctx, StepId, Event> = {
  initial: "one",
  context: {},
  steps: {
    one: {},
    two: {},
    three: {}
  },
  transitions: [
    { from: "one", event: "goToNextStep", to: "two" },
    { from: "two", event: "goToNextStep", to: "three" }
  ]
};

export const createSimpleBackMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(simpleBackJourney);
