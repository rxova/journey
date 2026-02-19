import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "validate" | "blocked" | "allowed";
type Event = "goToNextStep";
type Ctx = { token: string };

const isTokenValid = async (token: string) => token.length > 3;

export const asyncGuardJourney: JourneyDefinition<Ctx, StepId, Event> = {
  initial: "validate",
  context: { token: "abcd" },
  steps: {
    validate: {},
    blocked: {},
    allowed: {}
  },
  transitions: [
    {
      from: "validate",
      event: "goToNextStep",
      to: "allowed",
      when: async ({ context }) => isTokenValid(context.token)
    },
    {
      from: "validate",
      event: "goToNextStep",
      to: "blocked",
      when: async ({ context }) => !(await isTokenValid(context.token))
    }
  ]
};

export const createAsyncGuardMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(asyncGuardJourney);
