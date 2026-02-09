import React from "react";

import {
  HISTORY_TARGET,
  FLOW_TERMINAL,
  type FlowReactFlow,
  useFlow,
  FlowProvider,
  FlowStepRenderer
} from "../src";

type StepId = "category" | "details" | "screenshot" | "review" | "confirmClose";
type Ctx = {
  includeScreenshot: boolean;
  dirty: boolean;
};

const Category = () => {
  const { api } = useFlow<Ctx, StepId, never>();
  return <button onClick={() => api.next()}>Continue</button>;
};

const Details = () => {
  const { api } = useFlow<Ctx, StepId, never>();
  return <button onClick={() => api.next()}>Continue</button>;
};

const Screenshot = () => {
  const { api } = useFlow<Ctx, StepId, never>();
  return <button onClick={() => api.next()}>Continue</button>;
};

const Review = () => {
  const { api } = useFlow<Ctx, StepId, never>();
  return <button onClick={() => api.submit()}>Submit</button>;
};

const ConfirmClose = () => {
  const { api } = useFlow<Ctx, StepId, never>();
  return <button onClick={() => api.close()}>Discard</button>;
};

export const supportTicketFlow: FlowReactFlow<Ctx, StepId, never> = {
  initial: "category",
  context: {
    includeScreenshot: false,
    dirty: false
  },
  steps: {
    category: { component: Category },
    details: { component: Details },
    screenshot: { component: Screenshot },
    review: { component: Review },
    confirmClose: { component: ConfirmClose }
  },
  transitions: [
    { from: "category", event: "next", to: "details" },
    {
      from: "details",
      event: "next",
      to: "screenshot",
      when: ({ context }) => context.includeScreenshot
    },
    {
      from: "details",
      event: "next",
      to: "review",
      when: ({ context }) => !context.includeScreenshot
    },
    { from: "screenshot", event: "next", to: "review" },
    { from: "*", event: "back", to: HISTORY_TARGET },
    {
      from: "*",
      event: "close",
      to: "confirmClose",
      when: ({ context }) => context.dirty
    },
    {
      from: "*",
      event: "close",
      to: FLOW_TERMINAL.CLOSE,
      when: ({ context }) => !context.dirty
    },
    { from: "review", event: "submit", to: FLOW_TERMINAL.COMPLETE }
  ]
};

export const SupportTicketExample = () => (
  <FlowProvider flow={supportTicketFlow}>
    <FlowStepRenderer<Ctx, StepId> />
  </FlowProvider>
);
