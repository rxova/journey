import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type Ctx = { draftId: string | null };

const saveDraft = async () => "draft-123";

export const asyncEffectJourney: JourneyDefinition<Ctx> = {
  initial: "details",
  context: { draftId: null },
  steps: {
    details: {},
    review: {}
  },
  transitions: [
    {
      from: "details",
      event: "goToNextStep",
      to: "review",
      effect: async ({ context }) => ({ ...context, draftId: await saveDraft() })
    }
  ]
};

export const createAsyncEffectMachine = () => createJourneyMachine(asyncEffectJourney);
