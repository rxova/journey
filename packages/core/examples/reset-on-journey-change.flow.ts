import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "review";
type Ctx = { label: string };

export const buildResetJourney = (
  label: string,
  initial: StepId
): JourneyDefinition<Ctx, StepId> => ({
  initial,
  context: { label },
  steps: {
    start: {},
    review: {}
  },
  transitions: {
    start: { goToNextStep: [{ to: "review" }] },
    review: { completeJourney: [{}] }
  }
});

export const createResetOnChangeMachine = (variant: "A" | "B") => {
  const journey =
    variant === "A"
      ? buildResetJourney("Variant A", "start")
      : buildResetJourney("Variant B", "review");
  return createJourneyMachine(journey);
};
