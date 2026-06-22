import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "category" | "details" | "screenshot" | "review" | "confirmExit";
type EventMap = { type: "back"; payload?: unknown } | { type: "requestClose"; payload?: unknown };
type Ctx = {
  includeScreenshot: boolean;
  dirty: boolean;
};

export const supportTicketJourney: JourneyDefinition<Ctx, StepId, EventMap> = {
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
  transitions: {
    category: { goToNextStep: [{ to: "details" }] },
    details: {
      goToNextStep: [
        { to: "screenshot", when: ({ context }) => context.includeScreenshot },
        { to: "review", when: ({ context }) => !context.includeScreenshot }
      ]
    },
    screenshot: { goToNextStep: [{ to: "review" }] },
    review: { completeJourney: [{}] },
    global: {
      requestClose: [
        {
          to: "confirmExit",
          when: ({ context }) => context.dirty
        }
      ],
      terminateJourney: [{}]
    }
  }
};

export const createSupportTicketMachine = () => createJourneyMachine(supportTicketJourney);
