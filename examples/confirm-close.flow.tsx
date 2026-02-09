import React from "react";

import { FLOW_TERMINAL, type FlowReactFlow, useFlow, FlowProvider, FlowStepRenderer } from "../src";

type StepId = "edit" | "confirmExit";
type Ctx = { dirty: boolean };

const Edit = () => {
  const { api } = useFlow<Ctx, StepId>();
  return (
    <div>
      <button onClick={() => api.updateContext((ctx) => ({ ...ctx, dirty: true }))}>
        Make dirty
      </button>
      <button onClick={() => api.close()}>Close</button>
    </div>
  );
};

const ConfirmClose = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.close()}>Confirm close</button>;
};

export const confirmExitFlow: FlowReactFlow<Ctx, StepId> = {
  initial: "edit",
  context: { dirty: false },
  steps: {
    edit: { component: Edit },
    confirmExit: { component: ConfirmClose }
  },
  transitions: [
    {
      from: "*",
      event: "close",
      to: "confirmExit",
      when: ({ context }) => context.dirty
    },
    {
      from: "*",
      event: "close",
      to: FLOW_TERMINAL.CLOSE,
      when: ({ context }) => !context.dirty
    }
  ]
};

export const ConfirmCloseExample = () => (
  <FlowProvider flow={confirmExitFlow}>
    <FlowStepRenderer<Ctx, StepId> />
  </FlowProvider>
);
