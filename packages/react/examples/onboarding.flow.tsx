import React from "react";

import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "welcome" | "profile" | "teamInvite" | "recap";
type Ctx = {
  inviteTeam: boolean;
  dirty: boolean;
};

const Welcome = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Start onboarding</button>;
};

const Profile = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Save profile</button>;
};

const TeamInvite = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Skip invite</button>;
};

const Recap = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.completeJourney()}>Finish</button>;
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

const bindings = createJourneyBindings(onboardingJourney);

export const OnboardingExample = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;

  return (
    <Provider>
      <StepRenderer />
    </Provider>
  );
};
