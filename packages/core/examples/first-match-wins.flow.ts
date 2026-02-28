import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "first" | "second";
type Event = "goToNextStep";
type Ctx = { chooseFirst: boolean };

export const firstMatchWinsJourney: JourneyDefinition<Ctx, StepId, Event> = {
  initial: "start",
  context: { chooseFirst: true },
  steps: {
    start: {},
    first: {},
    second: {}
  },
  transitions: [
    {
      id: "first",
      from: "start",
      event: "goToNextStep",
      to: "first",
      when: ({ context }) => context.chooseFirst
    },
    {
      id: "second",
      from: "start",
      event: "goToNextStep",
      to: "second",
      when: ({ context }) => context.chooseFirst
    }
  ]
};

export const createFirstMatchWinsMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(firstMatchWinsJourney);
