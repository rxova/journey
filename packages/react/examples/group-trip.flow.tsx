import React from "react";

import {
  HISTORY_TARGET,
  JOURNEY_TERMINAL,
  type JourneyReactDefinition,
  useJourney,
  JourneyProvider,
  JourneyStepRenderer
} from "@rxova/journey-react";

type StepId = "invitees" | "preferences" | "budget" | "confirmPlan";
type Event = "next" | "back" | "close" | "submit";

type GroupTripContext = {
  needsBudgetReview: boolean;
};

const Invitees = () => {
  const { api } = useJourney<GroupTripContext, StepId, Event>();
  return <button onClick={() => api.next()}>Invite travelers</button>;
};

const Preferences = () => {
  const { api } = useJourney<GroupTripContext, StepId, Event>();
  return <button onClick={() => api.next()}>Save preferences</button>;
};

const Budget = () => {
  const { api } = useJourney<GroupTripContext, StepId, Event>();
  return <button onClick={() => api.next()}>Set budget</button>;
};

const ConfirmPlan = () => {
  const { api } = useJourney<GroupTripContext, StepId, Event>();
  return <button onClick={() => api.submit()}>Confirm plan</button>;
};

export const groupTripJourney: JourneyReactDefinition<GroupTripContext, StepId, Event> = {
  initial: "invitees",
  context: {
    needsBudgetReview: true
  },
  steps: {
    invitees: { component: Invitees },
    preferences: { component: Preferences },
    budget: { component: Budget },
    confirmPlan: { component: ConfirmPlan }
  },
  transitions: [
    { from: "invitees", event: "next", to: "preferences" },
    {
      from: "preferences",
      event: "next",
      to: "budget",
      when: ({ context }) => context.needsBudgetReview
    },
    {
      from: "preferences",
      event: "next",
      to: "confirmPlan",
      when: ({ context }) => !context.needsBudgetReview
    },
    { from: "budget", event: "next", to: "confirmPlan" },
    { from: "*", event: "back", to: HISTORY_TARGET },
    { from: "confirmPlan", event: "submit", to: JOURNEY_TERMINAL.COMPLETE },
    { from: "*", event: "close", to: JOURNEY_TERMINAL.CLOSE }
  ]
};

export const GroupTripExample = () => (
  <JourneyProvider journey={groupTripJourney}>
    <JourneyStepRenderer<GroupTripContext, StepId, Event> />
  </JourneyProvider>
);
