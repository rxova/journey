import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "s1" | "s2";
type Event = "goToNextStep" | "completeJourney";
type Ctx = Record<string, never>;

export const simpleSequenceJourney: JourneyDefinition<Ctx, StepId, Event> = {
  initial: "s1",
  context: {},
  steps: {
    s1: {},
    s2: {}
  },
  transitions: [
    { from: "s1", event: "goToNextStep", to: "s2" },
    { from: "s2", event: "completeJourney" }
  ]
};

export const createSimpleSequenceMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(simpleSequenceJourney);
