import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type Ctx = { draftId: string | null };
type StepId = "details" | "saving" | "review";
type EventMap = {
  draftSaved: {
    draftId: string;
  };
};
type Handlers = {
  saveDraft: () => Promise<string>;
};

const saveDraft = async () => "draft-123";

export const asyncEffectJourney: JourneyDefinition<Ctx, StepId, EventMap, unknown, Handlers> = {
  initial: "details",
  context: { draftId: null },
  handlers: {
    saveDraft
  },
  steps: {
    details: {},
    saving: {
      onEnter: async ({ handlers, dispatch }) => {
        const draftId = await handlers.saveDraft();
        await dispatch({
          type: "draftSaved",
          payload: { draftId }
        });
      }
    },
    review: {}
  },
  transitions: {
    details: {
      goToNextStep: [
        {
          to: "saving"
        }
      ]
    },
    saving: {
      draftSaved: [
        {
          to: "review",
          updateContext: ({ context, event }) => ({
            ...context,
            draftId: event.payload?.draftId ?? null
          })
        }
      ]
    }
  }
};

export const createAsyncEffectMachine = () => createJourneyMachine(asyncEffectJourney);
