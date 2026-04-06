import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "s1" | "s2";
type Ctx = Record<string, never>;

export const simpleSequenceJourney: JourneyDefinition<Ctx, StepId> = {
  context: {},
  steps: {
    s1: {},
    s2: {}
  },
  transitions: ["s1", "s2"]
};

export const createSimpleSequenceMachine = () =>
  createJourneyMachine(simpleSequenceJourney, { requireExplicitCompletion: true });
