import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "verify" | "review";
type Ctx = {
  token: string;
  verified: boolean;
};

const validateToken = async (token: string) => token.startsWith("ok-");

export const asyncTimeoutJourney: JourneyDefinition<Ctx, StepId> = {
  initial: "verify",
  context: {
    token: "ok-123",
    verified: false
  },
  steps: {
    verify: {},
    review: {}
  },
  transitions: {
    verify: {
      goToNextStep: [
        {
          id: "verify-and-save",
          to: "review",
          timeoutMs: 1_500,
          when: async ({ context }) => validateToken(context.token),
          updateContext: ({ context }) => ({
            ...context,
            verified: true
          })
        }
      ]
    }
  }
};

export const createAsyncTimeoutMachine = () => createJourneyMachine(asyncTimeoutJourney);

export const submitWithTimeoutRecovery = async () => {
  const machine = createAsyncTimeoutMachine();
  const result = await machine.goToNextStep();

  if (result.error instanceof Error && result.error.name === "JourneyTimeoutError") {
    await machine.clearStepError("verify");
  }

  return { machine, result };
};
