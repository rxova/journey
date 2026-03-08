import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "verify" | "review";
type Event = "goToNextStep";
type Ctx = {
  token: string;
  draftId: string | null;
};

const validateToken = async (token: string) => token.startsWith("ok-");
const persistDraft = async () => "draft-123";

export const asyncTimeoutJourney: JourneyDefinition<Ctx, StepId, Event> = {
  initial: "verify",
  context: {
    token: "ok-123",
    draftId: null
  },
  steps: {
    verify: {},
    review: {}
  },
  transitions: [
    {
      id: "verify-and-save",
      from: "verify",
      event: "goToNextStep",
      to: "review",
      timeoutMs: 1_500,
      when: async ({ context }) => validateToken(context.token),
      effect: async ({ context }) => ({
        ...context,
        draftId: await persistDraft()
      })
    }
  ]
};

export const createAsyncTimeoutMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(asyncTimeoutJourney);

export const submitWithTimeoutRecovery = async () => {
  const machine = createAsyncTimeoutMachine();
  const result = await machine.goToNextStep();

  if (result.error instanceof Error && result.error.name === "JourneyTimeoutError") {
    machine.clearStepError("verify");
  }

  return { machine, result };
};
