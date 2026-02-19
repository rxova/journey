import React from "react";

import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "step1" | "step2" | "review";
type Event = "goToNextStep" | "jumpToReview";
type Ctx = Record<string, never>;

const Step1 = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.send({ type: "jumpToReview" })}>Jump to review</button>;
};
const Step2 = () => <div>Step 2</div>;
const Review = () => <div>Review</div>;

export const goToJumpJourney: JourneyReactDefinition<Ctx, StepId, Event> = {
  initial: "step1",
  context: {},
  steps: {
    step1: { component: Step1 },
    step2: { component: Step2 },
    review: { component: Review }
  },
  transitions: [
    { from: "step1", event: "goToNextStep", to: "step2" },
    { from: "step1", event: "jumpToReview", to: "review" }
  ]
};

const bindings = createJourneyBindings(goToJumpJourney);

export const GoToJumpExample = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;

  return (
    <Provider>
      <StepRenderer />
    </Provider>
  );
};
