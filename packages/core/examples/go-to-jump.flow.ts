import { createJourneyMachine, JOURNEY_EVENT, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "step1" | "step2" | "review";
type Event = "next";
type Ctx = Record<string, never>;

export const goToJumpJourney: JourneyDefinition<Ctx, StepId, Event> = {
  initial: "step1",
  context: {},
  steps: {
    step1: {},
    step2: {},
    review: {}
  },
  transitions: [{ from: "step1", event: "next", to: "step2" }]
};

export const createGoToJumpMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(goToJumpJourney);

export const jumpToReview = async () => {
  const machine = createGoToJumpMachine();
  await machine.send({ type: JOURNEY_EVENT.GO_TO, to: "review" });
  return machine.getSnapshot();
};
