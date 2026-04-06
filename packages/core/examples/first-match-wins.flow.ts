import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "first" | "second";
type Ctx = { chooseFirst: boolean };

export const firstMatchWinsJourney: JourneyDefinition<Ctx, StepId> = {
  initial: "start",
  context: { chooseFirst: true },
  steps: {
    start: {},
    first: {},
    second: {}
  },
  transitions: {
    start: {
      goToNextStep: [
        {
          label: "first",
          to: "first",
          when: ({ context }) => context.chooseFirst
        },
        {
          label: "second",
          to: "second",
          when: ({ context }) => context.chooseFirst
        }
      ]
    }
  }
};

export const createFirstMatchWinsMachine = () => createJourneyMachine(firstMatchWinsJourney);
