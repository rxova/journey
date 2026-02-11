import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "idle" | "failed" | "done";
type Event = "retry";
type Ctx = { tries: number };

export const customEventJourney: JourneyDefinition<Ctx, StepId, Event> = {
  initial: "idle",
  context: { tries: 0 },
  steps: {
    idle: {},
    failed: {},
    done: {}
  },
  transitions: [
    {
      from: "idle",
      event: "retry",
      to: "failed",
      effect: ({ context }) => ({ ...context, tries: context.tries + 1 })
    },
    {
      from: "failed",
      event: "retry",
      to: "done",
      when: ({ context }) => context.tries > 0
    }
  ]
};

export const createCustomEventMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(customEventJourney);
