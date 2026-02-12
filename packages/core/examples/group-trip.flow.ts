import {
  createJourneyMachine,
  HISTORY_TARGET,
  JOURNEY_TERMINAL,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = "invitees" | "preferences" | "budget" | "confirmPlan";
type Event = "next" | "back" | "close" | "submit";

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
    { from: "invitees", event: "next", to: "preferences" },
    {
      from: "preferences",
      event: "next",
      to: "budget",
      when: ({ context }) => context.needsBudgetReview
    },
    {
      from: "preferences",
      event: "next",
      to: "confirmPlan",
      when: ({ context }) => !context.needsBudgetReview
    },
    { from: "budget", event: "next", to: "confirmPlan" },
    { from: "*", event: "back", to: HISTORY_TARGET },
    { from: "confirmPlan", event: "submit", to: JOURNEY_TERMINAL.COMPLETE },
    { from: "*", event: "close", to: JOURNEY_TERMINAL.CLOSE }
  ]
};

export const createGroupTripMachine = () =>
  createJourneyMachine<GroupTripContext, StepId, Event>(groupTripJourney);
