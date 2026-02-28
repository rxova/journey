import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "category" | "details" | "screenshot" | "review" | "confirmExit";
type Event = "goToNextStep" | "back" | "requestClose" | "terminateJourney" | "completeJourney";
type Ctx = {
  includeScreenshot: boolean;
  dirty: boolean;
};

export const supportTicketJourney: JourneyDefinition<Ctx, StepId, Event> = {
  initial: "category",
  context: {
    includeScreenshot: false,
    dirty: false
  },
  steps: {
    category: {},
    details: {},
    screenshot: {},
    review: {},
    confirmExit: {}
  },
  transitions: [
    { from: "category", event: "goToNextStep", to: "details" },
    {
      from: "details",
      event: "goToNextStep",
      to: "screenshot",
      when: ({ context }) => context.includeScreenshot
    },
    {
      from: "details",
      event: "goToNextStep",
      to: "review",
      when: ({ context }) => !context.includeScreenshot
    },
    { from: "screenshot", event: "goToNextStep", to: "review" },
    {
      from: "*",
      event: "requestClose",
      to: "confirmExit",
      when: ({ context }) => context.dirty
    },
    { from: "*", event: "terminateJourney" },
    { from: "review", event: "completeJourney" }
  ]
};

export const createSupportTicketMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(supportTicketJourney);
