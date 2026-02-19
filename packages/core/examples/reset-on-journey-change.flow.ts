import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "review";
type Event = "goToNextStep" | "completeJourney";
type Ctx = { label: string };

export const buildResetJourney = (
  label: string,
  initial: StepId
): JourneyDefinition<Ctx, StepId, Event> => ({
  initial,
  context: { label },
  steps: {
    start: {},
    review: {}
  },
  transitions: [
    { from: "start", event: "goToNextStep", to: "review" },
    { from: "review", event: "completeJourney" }
  ]
});

export const createResetOnChangeMachine = (variant: "A" | "B") => {
  const journey =
    variant === "A"
      ? buildResetJourney("Variant A", "start")
      : buildResetJourney("Variant B", "review");
  return createJourneyMachine<Ctx, StepId, Event>(journey);
};
