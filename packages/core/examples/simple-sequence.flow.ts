import {
  createJourneyMachine,
  JOURNEY_TERMINAL,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = "s1" | "s2";
type Event = "next" | "submit";
type Ctx = Record<string, never>;

export const simpleSequenceJourney: JourneyDefinition<Ctx, StepId, Event> = {
  initial: "s1",
  context: {},
  steps: {
    s1: {},
    s2: {}
  },
  transitions: [
    { from: "s1", event: "next", to: "s2" },
    { from: "s2", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};

export const createSimpleSequenceMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(simpleSequenceJourney);
