import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "invitees" | "preferences" | "budget" | "confirmPlan";

type GroupTripContext = {
  needsBudgetReview: boolean;
};

export const groupTripJourney: JourneyDefinition<GroupTripContext, StepId> = {
  initial: "invitees",
  context: {
    needsBudgetReview: true
  },
  steps: {
    invitees: {},
    preferences: {},
    budget: {},
    confirmPlan: {}
  },
  transitions: {
    invitees: { goToNextStep: [{ to: "preferences" }] },
    preferences: {
      goToNextStep: [
        { to: "budget", when: ({ context }) => context.needsBudgetReview },
        { to: "confirmPlan", when: ({ context }) => !context.needsBudgetReview }
      ]
    },
    budget: { goToNextStep: [{ to: "confirmPlan" }] },
    confirmPlan: { completeJourney: [{}] }
  }
};

export const createGroupTripMachine = () => createJourneyMachine(groupTripJourney);
