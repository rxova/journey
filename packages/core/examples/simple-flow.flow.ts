import {
  createJourneyMachine,
  JOURNEY_TERMINAL,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = "one" | "two" | "three";
type Event = "next" | "submit";
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
    { from: "one", event: "next", to: "two" },
    { from: "two", event: "next", to: "three" },
    { from: "three", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};

export const createSimpleJourneyMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(simpleJourney);
