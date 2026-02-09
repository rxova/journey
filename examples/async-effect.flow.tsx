import React from "react";

import { type FlowReactFlow, useFlow, FlowProvider, FlowStepRenderer } from "../src";

type StepId = "details" | "review";
type Ctx = { draftId: string | null };

const saveDraft = async () => "draft-123";

const Details = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.next()}>Save draft</button>;
};
const Review = () => {
  const { snapshot } = useFlow<Ctx, StepId>();
  return <div>Draft: {snapshot.context.draftId ?? "none"}</div>;
};

export const asyncEffectFlow: FlowReactFlow<Ctx, StepId> = {
  initial: "details",
  context: { draftId: null },
  steps: {
    details: { component: Details },
    review: { component: Review }
  },
  transitions: [
    {
      from: "details",
      event: "next",
      to: "review",
      effect: async ({ context }) => ({ ...context, draftId: await saveDraft() })
    }
  ]
};

export const AsyncEffectExample = () => (
  <FlowProvider flow={asyncEffectFlow}>
    <FlowStepRenderer<Ctx, StepId> />
  </FlowProvider>
);
