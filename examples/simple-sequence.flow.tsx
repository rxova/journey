import React from "react";

import { FLOW_TERMINAL, type FlowReactFlow, useFlow, FlowProvider, FlowStepRenderer } from "../src";

type StepId = "s1" | "s2";
type Ctx = Record<string, never>;

const S1 = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.next()}>Continue</button>;
};

const S2 = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.submit()}>Done</button>;
};

export const simpleSequenceFlow: FlowReactFlow<Ctx, StepId> = {
  initial: "s1",
  context: {},
  steps: {
    s1: { component: S1 },
    s2: { component: S2 }
  },
  transitions: [
    { from: "s1", event: "next", to: "s2" },
    { from: "s2", event: "submit", to: FLOW_TERMINAL.COMPLETE }
  ]
};

export const SimpleSequenceFlowExample = () => (
  <FlowProvider flow={simpleSequenceFlow}>
    <FlowStepRenderer<Ctx, StepId> />
  </FlowProvider>
);
