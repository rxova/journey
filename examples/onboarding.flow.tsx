import React from "react";

import {
  HISTORY_TARGET,
  FLOW_TERMINAL,
  type FlowReactFlow,
  useFlow,
  FlowProvider,
  FlowStepRenderer
} from "@/src";

type StepId = "welcome" | "profile" | "teamInvite" | "recap";
type Ctx = {
  inviteTeam: boolean;
  dirty: boolean;
};

const Welcome = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.next()}>Start onboarding</button>;
};

const Profile = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.next()}>Save profile</button>;
};

const TeamInvite = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.next()}>Skip invite</button>;
};

const Summary = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.submit()}>Finish</button>;
};

export const onboardingFlow: FlowReactFlow<Ctx, StepId, never> = {
  initial: "welcome",
  context: {
    inviteTeam: false,
    dirty: false
  },
  steps: {
    welcome: { component: Welcome },
    profile: { component: Profile },
    teamInvite: { component: TeamInvite },
    summary: { component: Summary }
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
    { from: "recap", event: "submit", to: FLOW_TERMINAL.COMPLETE },
    { from: "*", event: "close", to: FLOW_TERMINAL.CLOSE }
  ]
};

export const OnboardingExample = () => (
  <FlowProvider flow={onboardingFlow}>
    <FlowStepRenderer<Ctx, StepId> />
  </FlowProvider>
);
