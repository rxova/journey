import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "idle" | "failed" | "done";
type EventMap = { retry: unknown };
type Ctx = { tries: number };

export const customEventJourney: JourneyDefinition<Ctx, StepId, EventMap> = {
  initial: "idle",
  context: { tries: 0 },
  steps: {
    idle: {},
    failed: {},
    done: {}
  },
  transitions: {
    idle: {
      retry: [
        {
          to: "failed",
          updateContext: ({ context }) => ({ ...context, tries: context.tries + 1 })
        }
      ]
    },
    failed: {
      retry: [{ to: "done", when: ({ context }) => context.tries > 0 }]
    }
  }
};

export const createCustomEventMachine = () =>
  createJourneyMachine<Ctx, StepId, EventMap>(customEventJourney);
