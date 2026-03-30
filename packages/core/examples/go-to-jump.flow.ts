import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "step1" | "step2" | "review";
type Ctx = Record<string, never>;

export const goToJumpJourney: JourneyDefinition<Ctx, StepId> = {
  context: {},
  steps: {
    step1: {},
    step2: {},
    review: {}
  },
  transitions: ["step1", "step2"]
};

export const createGoToJumpMachine = () => createJourneyMachine<Ctx, StepId>(goToJumpJourney);

export const jumpToReview = async () => {
  const machine = createGoToJumpMachine();
  await machine.send({ type: "goToStepById", stepId: "review" });
  return machine.getSnapshot();
};
