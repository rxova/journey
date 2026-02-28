import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "welcome" | "profile" | "teamInvite" | "recap";
type Event = "goToNextStep" | "back" | "terminateJourney" | "completeJourney";
type Ctx = {
  inviteTeam: boolean;
  dirty: boolean;
};

export const onboardingJourney: JourneyDefinition<Ctx, StepId, Event> = {
  initial: "welcome",
  context: {
    inviteTeam: false,
    dirty: false
  },
  steps: {
    welcome: {},
    profile: {},
    teamInvite: {},
    recap: {}
  },
  transitions: [
    { from: "welcome", event: "goToNextStep", to: "profile" },
    {
      from: "profile",
      event: "goToNextStep",
      to: "teamInvite",
      when: ({ context }) => context.inviteTeam
    },
    {
      from: "profile",
      event: "goToNextStep",
      to: "recap",
      when: ({ context }) => !context.inviteTeam
    },
    { from: "teamInvite", event: "goToNextStep", to: "recap" },
    { from: "recap", event: "completeJourney" },
    { from: "*", event: "terminateJourney" }
  ]
};

export const createOnboardingMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(onboardingJourney);
