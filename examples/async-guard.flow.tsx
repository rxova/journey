import React from "react";

import { type FlowReactFlow, useFlow, FlowProvider, FlowStepRenderer } from "../src";

type StepId = "validate" | "blocked" | "allowed";
type Ctx = { token: string };

const Validate = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.next()}>Check token</button>;
};
const Blocked = () => <div>Blocked</div>;
const Allowed = () => <div>Allowed</div>;

const isTokenValid = async (token: string) => token.length > 3;

export const asyncGuardFlow: FlowReactFlow<Ctx, StepId> = {
  initial: "validate",
  context: { token: "abcd" },
  steps: {
    validate: { component: Validate },
    blocked: { component: Blocked },
    allowed: { component: Allowed }
  },
  transitions: [
    {
      from: "validate",
      event: "next",
      to: "allowed",
      when: async ({ context }) => isTokenValid(context.token)
    },
    {
      from: "validate",
      event: "next",
      to: "blocked",
      when: async ({ context }) => !(await isTokenValid(context.token))
    }
  ]
};

export const AsyncGuardExample = () => (
  <FlowProvider flow={asyncGuardFlow}>
    <FlowStepRenderer<Ctx, StepId> />
  </FlowProvider>
);
