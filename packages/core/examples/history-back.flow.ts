import { createJourneyMachine, HISTORY_TARGET, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "branchA" | "branchB" | "review";
type Event = "next" | "back";
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
      event: "next",
      to: "branchA",
      when: ({ context }) => context.branch === "A"
    },
    {
      from: "start",
      event: "next",
      to: "branchB",
      when: ({ context }) => context.branch === "B"
    },
    { from: "branchA", event: "next", to: "review" },
    { from: "branchB", event: "next", to: "review" },
    { from: "*", event: "back", to: HISTORY_TARGET }
  ]
};

export const createHistoryBackMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(historyBackJourney);
