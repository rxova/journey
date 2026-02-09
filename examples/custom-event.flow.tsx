import React from "react";

import { type FlowReactFlow, useFlow, FlowProvider, FlowStepRenderer } from "../src";

type StepId = "idle" | "failed" | "done";
type CustomEvent = "retry";
type Ctx = { tries: number };

const Idle = () => {
  const { api } = useFlow<Ctx, StepId, CustomEvent>();
  return <button onClick={() => api.send({ type: "retry" })}>Retry</button>;
};
const Failed = () => {
  const { api } = useFlow<Ctx, StepId, CustomEvent>();
  return <button onClick={() => api.send({ type: "retry" })}>Retry</button>;
};
const Done = () => <div>Done</div>;

export const customEventFlow: FlowReactFlow<Ctx, StepId, CustomEvent> = {
  initial: "idle",
  context: { tries: 0 },
  steps: {
    idle: { component: Idle },
    failed: { component: Failed },
    done: { component: Done }
  },
  transitions: [
    {
      from: "idle",
      event: "retry",
      to: "failed",
      effect: ({ context }) => ({ ...context, tries: context.tries + 1 })
    },
    {
      from: "failed",
      event: "retry",
      to: "done",
      when: ({ context }) => context.tries > 0
    }
  ]
};

export const CustomEventExample = () => (
  <FlowProvider flow={customEventFlow}>
    <FlowStepRenderer<Ctx, StepId, CustomEvent> />
  </FlowProvider>
);
