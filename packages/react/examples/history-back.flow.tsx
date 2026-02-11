import React from "react";

import {
  HISTORY_TARGET,
  type JourneyReactDefinition,
  useJourney,
  JourneyProvider,
  JourneyStepRenderer
} from "@rxova/journey-react";

type StepId = "start" | "branchA" | "branchB" | "review";
type Ctx = { branch: "A" | "B" };

const Start = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.next()}>Next</button>;
};
const BranchA = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.next()}>To review</button>;
};
const BranchB = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.next()}>To review</button>;
};
const Review = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.back()}>Back by history</button>;
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
      event: "next",
      to: "branchA",
      when: ({ context }) => context.branch === "A"
    },
    {
      from: "start",
      event: "next",
      to: "branchB",
      when: ({ context }) => context.branch === "B"
    },
    { from: "branchA", event: "next", to: "review" },
    { from: "branchB", event: "next", to: "review" },
    { from: "*", event: "back", to: HISTORY_TARGET }
  ]
};

export const HistoryBackExample = () => (
  <JourneyProvider journey={historyBackJourney}>
    <JourneyStepRenderer<Ctx, StepId> />
  </JourneyProvider>
);
