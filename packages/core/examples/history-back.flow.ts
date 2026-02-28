import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "branchA" | "branchB" | "review";
type Event = "goToNextStep" | "back";
type Ctx = { branch: "A" | "B" };

export const historyBackJourney: JourneyDefinition<Ctx, StepId, Event> = {
  initial: "start",
  context: { branch: "A" },
  steps: {
    start: {},
    branchA: {},
    branchB: {},
    review: {}
  },
  transitions: [
    {
      from: "start",
      event: "goToNextStep",
      to: "branchA",
      when: ({ context }) => context.branch === "A"
    },
    {
      from: "start",
      event: "goToNextStep",
      to: "branchB",
      when: ({ context }) => context.branch === "B"
    },
    { from: "branchA", event: "goToNextStep", to: "review" },
    { from: "branchB", event: "goToNextStep", to: "review" }
  ]
};

export const createHistoryBackMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(historyBackJourney);
