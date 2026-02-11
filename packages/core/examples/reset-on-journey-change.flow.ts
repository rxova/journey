import {
  createJourneyMachine,
  JOURNEY_TERMINAL,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = "start" | "review";
type Event = "next" | "submit";
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
    { from: "start", event: "next", to: "review" },
    { from: "review", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
});

export const createResetOnChangeMachine = (variant: "A" | "B") => {
  const journey =
    variant === "A"
      ? buildResetJourney("Variant A", "start")
      : buildResetJourney("Variant B", "review");
  return createJourneyMachine<Ctx, StepId, Event>(journey);
};
