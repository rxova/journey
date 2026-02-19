import React from "react";

import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "start" | "branchA" | "branchB" | "review";
type Ctx = { branch: "A" | "B" };

const Start = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Next</button>;
};
const BranchA = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>To review</button>;
};
const BranchB = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>To review</button>;
};
const Review = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToPreviousStep()}>Back by history</button>;
};

export const historyBackJourney: JourneyReactDefinition<Ctx, StepId> = {
  initial: "start",
  context: { branch: "A" },
  steps: {
    start: { component: Start },
    branchA: { component: BranchA },
    branchB: { component: BranchB },
    review: { component: Review }
  },
  transitions: [
    {
      from: "start",
      event: "goToNextStep",
      to: "branchA",
      when: ({ context }) => context.branch === "A"
    },
    {
      from: "start",
      event: "goToNextStep",
      to: "branchB",
      when: ({ context }) => context.branch === "B"
    },
    { from: "branchA", event: "goToNextStep", to: "review" },
    { from: "branchB", event: "goToNextStep", to: "review" }
  ]
};

const bindings = createJourneyBindings(historyBackJourney);

export const HistoryBackExample = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;

  return (
    <Provider>
      <StepRenderer />
    </Provider>
  );
};
