import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "welcome" | "profile" | "teamInvite" | "recap";
type Ctx = {
  inviteTeam: boolean;
  dirty: boolean;
};

export const onboardingJourney: JourneyDefinition<Ctx, StepId> = {
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
  transitions: {
    welcome: { goToNextStep: [{ to: "profile" }] },
    profile: {
      goToNextStep: [
        { to: "teamInvite", when: ({ context }) => context.inviteTeam },
        { to: "recap", when: ({ context }) => !context.inviteTeam }
      ]
    },
    teamInvite: { goToNextStep: [{ to: "recap" }] },
    recap: { completeJourney: [{}] },
    global: { terminateJourney: [{}] }
  }
};

export const createOnboardingMachine = () => createJourneyMachine(onboardingJourney);
