import { createJourneyMachine, HISTORY_TARGET, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "one" | "two" | "three";
type Event = "next" | "back";
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
    { from: "one", event: "next", to: "two" },
    { from: "two", event: "next", to: "three" },
    { from: "*", event: "back", to: HISTORY_TARGET }
  ]
};

export const createSimpleBackMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(simpleBackJourney);
