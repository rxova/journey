import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "validate" | "blocked" | "allowed";
type Ctx = { token: string };

const isTokenValid = async (token: string) => token.length > 3;

export const asyncGuardJourney: JourneyDefinition<Ctx, StepId> = {
  initial: "validate",
  context: { token: "abcd" },
  steps: {
    validate: {},
    blocked: {},
    allowed: {}
  },
  transitions: {
    validate: {
      goToNextStep: [
        {
          to: "allowed",
          when: async ({ context }) => isTokenValid(context.token)
        },
        {
          to: "blocked",
          when: async ({ context }) => !(await isTokenValid(context.token))
        }
      ]
    }
  }
};

export const createAsyncGuardMachine = () => createJourneyMachine(asyncGuardJourney);
