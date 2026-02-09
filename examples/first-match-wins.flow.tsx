import React from "react";

import { type FlowReactFlow, useFlow, FlowProvider, FlowStepRenderer } from "../src";

type StepId = "start" | "first" | "second";
type Ctx = { chooseFirst: boolean };

const Start = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.next()}>Next</button>;
};
const First = () => <div>First</div>;
const Second = () => <div>Second</div>;

export const firstMatchWinsFlow: FlowReactFlow<Ctx, StepId> = {
  initial: "start",
  context: { chooseFirst: true },
  steps: {
    start: { component: Start },
    first: { component: First },
    second: { component: Second }
  },
  transitions: [
    {
      id: "first",
      from: "start",
      event: "next",
      to: "first",
      when: ({ context }) => context.chooseFirst
    },
    {
      id: "second",
      from: "start",
      event: "next",
      to: "second",
      when: ({ context }) => context.chooseFirst
    }
  ]
};

export const FirstMatchWinsExample = () => (
  <FlowProvider flow={firstMatchWinsFlow}>
    <FlowStepRenderer<Ctx, StepId> />
  </FlowProvider>
);
