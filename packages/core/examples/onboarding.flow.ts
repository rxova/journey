import {
  createJourneyMachine,
  HISTORY_TARGET,
  JOURNEY_TERMINAL,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = "welcome" | "profile" | "teamInvite" | "summary";
type Event = "next" | "back" | "close" | "submit";
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
    summary: {}
  },
  transitions: [
    { from: "welcome", event: "next", to: "profile" },
    {
      from: "profile",
      event: "next",
      to: "teamInvite",
      when: ({ context }) => context.inviteTeam
    },
    {
      from: "profile",
      event: "next",
      to: "summary",
      when: ({ context }) => !context.inviteTeam
    },
    { from: "teamInvite", event: "next", to: "summary" },
    { from: "*", event: "back", to: HISTORY_TARGET },
    { from: "summary", event: "submit", to: JOURNEY_TERMINAL.COMPLETE },
    { from: "*", event: "close", to: JOURNEY_TERMINAL.CLOSE }
  ]
};

export const createOnboardingMachine = () =>
  createJourneyMachine<Ctx, StepId, Event>(onboardingJourney);
