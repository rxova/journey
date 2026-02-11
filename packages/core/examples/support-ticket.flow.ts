import {
  createJourneyMachine,
  HISTORY_TARGET,
  JOURNEY_TERMINAL,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = "category" | "details" | "screenshot" | "review" | "confirmClose";
type Event = "next" | "back" | "close" | "submit";
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
    confirmClose: {}
  },
  transitions: [
    { from: "category", event: "next", to: "details" },
    {
      from: "details",
      event: "next",
      to: "screenshot",
      when: ({ context }) => context.includeScreenshot
    },
    {
      from: "details",
      event: "next",
      to: "review",
      when: ({ context }) => !context.includeScreenshot
    },
    { from: "screenshot", event: "next", to: "review" },
    { from: "*", event: "back", to: HISTORY_TARGET },
    {
      from: "*",
      event: "close",
      to: "confirmClose",
      when: ({ context }) => context.dirty
    },
    {
      from: "*",
      event: "close",
      to: JOURNEY_TERMINAL.CLOSE,
      when: ({ context }) => !context.dirty
    },
    { from: "review", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};

export const createSupportTicketMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(supportTicketJourney);
