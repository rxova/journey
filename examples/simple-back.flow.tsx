import React from "react";

import {
  HISTORY_TARGET,
  type FlowReactFlow,
  useFlow,
  FlowProvider,
  FlowStepRenderer
} from "../src";

type StepId = "one" | "two" | "three";
type Ctx = Record<string, never>;

const One = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.next()}>Go</button>;
};

const Two = () => {
  const { api } = useFlow<Ctx, StepId>();
  return (
    <div>
      <button onClick={() => api.back()}>Back</button>
      <button onClick={() => api.next()}>Next</button>
    </div>
  );
};

const Three = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.back()}>Back</button>;
};

export const simpleBackFlow: FlowReactFlow<Ctx, StepId> = {
  initial: "one",
  context: {},
  steps: {
    one: { component: One },
    two: { component: Two },
    three: { component: Three }
  },
  transitions: [
    { from: "one", event: "next", to: "two" },
    { from: "two", event: "next", to: "three" },
    { from: "*", event: "back", to: HISTORY_TARGET }
  ]
};

export const SimpleBackFlowExample = () => (
  <FlowProvider flow={simpleBackFlow}>
    <FlowStepRenderer<Ctx, StepId> />
  </FlowProvider>
);
