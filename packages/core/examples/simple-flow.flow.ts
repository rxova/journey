import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "one" | "two" | "three";
type Event = "goToNextStep" | "completeJourney";
type Ctx = { name: string };

export const simpleJourney: JourneyDefinition<Ctx, StepId, Event> = {
  initial: "one",
  context: { name: "" },
  steps: {
    one: {},
    two: {},
    three: {}
  },
  transitions: [
    { from: "one", event: "goToNextStep", to: "two" },
    { from: "two", event: "goToNextStep", to: "three" },
    { from: "three", event: "completeJourney" }
  ]
};

export const createSimpleJourneyMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(simpleJourney);
