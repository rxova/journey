import React from "react";

import { FLOW_TERMINAL, type FlowReactFlow, useFlow, FlowProvider, FlowStepRenderer } from "../src";

type StepId = "start" | "optional" | "review";
type Ctx = { includeOptional: boolean };

const Start = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.next()}>Next</button>;
};
const Optional = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.next()}>Next</button>;
};
const Review = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.submit()}>Submit</button>;
};

export const conditionalSkipFlow: FlowReactFlow<Ctx, StepId> = {
  initial: "start",
  context: { includeOptional: false },
  steps: {
    start: { component: Start },
    optional: { component: Optional },
    review: { component: Review }
  },
  transitions: [
    {
      from: "start",
      event: "next",
      to: "optional",
      when: ({ context }) => context.includeOptional
    },
    {
      from: "start",
      event: "next",
      to: "review",
      when: ({ context }) => !context.includeOptional
    },
    { from: "optional", event: "next", to: "review" },
    { from: "review", event: "submit", to: FLOW_TERMINAL.COMPLETE }
  ]
};

export const ConditionalSkipExample = () => (
  <FlowProvider flow={conditionalSkipFlow}>
    <FlowStepRenderer<Ctx, StepId> />
  </FlowProvider>
);
