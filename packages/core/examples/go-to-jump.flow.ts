import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "step1" | "step2" | "review";
type Event = "goToNextStep";
type Ctx = Record<string, never>;

export const goToJumpJourney: JourneyDefinition<Ctx, StepId, Event> = {
  initial: "step1",
  context: {},
  steps: {
    step1: {},
    step2: {},
    review: {}
  },
  transitions: [{ from: "step1", event: "goToNextStep", to: "step2" }]
};

export const createGoToJumpMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(goToJumpJourney);

export const jumpToReview = async () => {
  const machine = createGoToJumpMachine();
  await machine.send({ type: "goToStepById", stepId: "review" });
  return machine.getSnapshot();
};
