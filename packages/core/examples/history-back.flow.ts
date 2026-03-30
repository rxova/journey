import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "branchA" | "branchB" | "review";
type Ctx = { branch: "A" | "B" };

export const historyBackJourney: JourneyDefinition<Ctx, StepId> = {
  initial: "start",
  context: { branch: "A" },
  steps: {
    start: {},
    branchA: {},
    branchB: {},
    review: {}
  },
  transitions: {
    start: {
      goToNextStep: [
        { to: "branchA", when: ({ context }) => context.branch === "A" },
        { to: "branchB", when: ({ context }) => context.branch === "B" }
      ]
    },
    branchA: { goToNextStep: [{ to: "review" }] },
    branchB: { goToNextStep: [{ to: "review" }] }
  }
};

export const createHistoryBackMachine = () => createJourneyMachine(historyBackJourney);
