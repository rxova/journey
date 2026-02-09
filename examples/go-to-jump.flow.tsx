import React from "react";

import { type FlowReactFlow, useFlow, FlowProvider, FlowStepRenderer } from "../src";

type StepId = "step1" | "step2" | "review";
type Ctx = Record<string, never>;

const Step1 = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.goTo("review")}>Jump to review</button>;
};
const Step2 = () => <div>Step 2</div>;
const Review = () => <div>Review</div>;

export const goToJumpFlow: FlowReactFlow<Ctx, StepId> = {
  initial: "step1",
  context: {},
  steps: {
    step1: { component: Step1 },
    step2: { component: Step2 },
    review: { component: Review }
  },
  transitions: [{ from: "step1", event: "next", to: "step2" }]
};

export const GoToJumpExample = () => (
  <FlowProvider flow={goToJumpFlow}>
    <FlowStepRenderer<Ctx, StepId> />
  </FlowProvider>
);
