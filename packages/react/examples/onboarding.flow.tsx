import React from "react";

import {
  HISTORY_TARGET,
  JOURNEY_TERMINAL,
  type JourneyReactDefinition,
  useJourney,
  JourneyProvider,
  JourneyStepRenderer
} from "@rxova/journey-react";

type StepId = "welcome" | "profile" | "teamInvite" | "recap";
type Ctx = {
  inviteTeam: boolean;
  dirty: boolean;
};

const Welcome = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.next()}>Start onboarding</button>;
};

const Profile = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.next()}>Save profile</button>;
};

const TeamInvite = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.next()}>Skip invite</button>;
};

const Recap = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.submit()}>Finish</button>;
};

export const onboardingJourney: JourneyReactDefinition<Ctx, StepId, never> = {
  initial: "welcome",
  context: {
    inviteTeam: false,
    dirty: false
  },
  steps: {
    welcome: { component: Welcome },
    profile: { component: Profile },
    teamInvite: { component: TeamInvite },
    recap: { component: Recap }
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
      to: "recap",
      when: ({ context }) => !context.inviteTeam
    },
    { from: "teamInvite", event: "next", to: "recap" },
    { from: "*", event: "back", to: HISTORY_TARGET },
    { from: "recap", event: "submit", to: JOURNEY_TERMINAL.COMPLETE },
    { from: "*", event: "close", to: JOURNEY_TERMINAL.CLOSE }
  ]
};

export const OnboardingExample = () => (
  <JourneyProvider journey={onboardingJourney}>
    <JourneyStepRenderer<Ctx, StepId> />
  </JourneyProvider>
);
