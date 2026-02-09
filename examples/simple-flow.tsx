import React from "react";

import { FLOW_TERMINAL, type FlowReactFlow, useFlow, FlowProvider, FlowStepRenderer } from "../src";

type StepId = "one" | "two" | "three";
type Ctx = { name: string };

const One = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.next()}>Next</button>;
};

const Two = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.next()}>Next</button>;
};

const Three = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.submit()}>Finish</button>;
};

export const simpleFlow: FlowReactFlow<Ctx, StepId> = {
  initial: "one",
  context: { name: "" },
  steps: {
    one: { component: One },
    two: { component: Two },
    three: { component: Three }
  },
  transitions: [
    { from: "one", event: "next", to: "two" },
    { from: "two", event: "next", to: "three" },
    { from: "three", event: "submit", to: FLOW_TERMINAL.COMPLETE }
  ]
};

export const SimpleFlowExample = () => (
  <FlowProvider flow={simpleFlow}>
    <FlowStepRenderer<Ctx, StepId> />
  </FlowProvider>
);
