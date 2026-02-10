import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "details" | "review";
type Event = "next";
type Ctx = { draftId: string | null };

const saveDraft = async () => "draft-123";

export const asyncEffectJourney: JourneyDefinition<Ctx, StepId, Event> = {
  initial: "details",
  context: { draftId: null },
  steps: {
    details: {},
    review: {}
  },
  transitions: [
    {
      from: "details",
      event: "next",
      to: "review",
      effect: async ({ context }) => ({ ...context, draftId: await saveDraft() })
    }
  ]
};

export const createAsyncEffectMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(asyncEffectJourney);
