import React from "react";

import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "invitees" | "preferences" | "budget" | "confirmPlan";
type Event = "goToNextStep" | "back" | "terminateJourney" | "completeJourney";

type GroupTripContext = {
  needsBudgetReview: boolean;
};

const Invitees = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Invite travelers</button>;
};

const Preferences = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Save preferences</button>;
};

const Budget = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Set budget</button>;
};

const ConfirmPlan = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.completeJourney()}>Confirm plan</button>;
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
    { from: "invitees", event: "goToNextStep", to: "preferences" },
    {
      from: "preferences",
      event: "goToNextStep",
      to: "budget",
      when: ({ context }) => context.needsBudgetReview
    },
    {
      from: "preferences",
      event: "goToNextStep",
      to: "confirmPlan",
      when: ({ context }) => !context.needsBudgetReview
    },
    { from: "budget", event: "goToNextStep", to: "confirmPlan" },
    { from: "confirmPlan", event: "completeJourney" },
    { from: "*", event: "terminateJourney" }
  ]
};

const bindings = createJourneyBindings(groupTripJourney);

export const GroupTripExample = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;

  return (
    <Provider>
      <StepRenderer />
    </Provider>
  );
};
