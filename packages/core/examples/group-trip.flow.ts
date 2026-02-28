import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "invitees" | "preferences" | "budget" | "confirmPlan";
type Event = "goToNextStep" | "back" | "terminateJourney" | "completeJourney";

type GroupTripContext = {
  needsBudgetReview: boolean;
};

export const groupTripJourney: JourneyDefinition<GroupTripContext, StepId, Event> = {
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
  transitions: [
    { from: "invitees", event: "goToNextStep", to: "preferences" },
    {
      from: "preferences",
      event: "goToNextStep",
      to: "budget",
      when: ({ context }) => context.needsBudgetReview
    },
    {
      from: "preferences",
      event: "goToNextStep",
      to: "confirmPlan",
      when: ({ context }) => !context.needsBudgetReview
    },
    { from: "budget", event: "goToNextStep", to: "confirmPlan" },
    { from: "confirmPlan", event: "completeJourney" },
    { from: "*", event: "terminateJourney" }
  ]
};

export const createGroupTripMachine = () =>
  createJourneyMachine<GroupTripContext, StepId, Event>(groupTripJourney);
