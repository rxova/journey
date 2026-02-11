import React from "react";

import {
  JOURNEY_TERMINAL,
  type JourneyReactDefinition,
  useJourney,
  JourneyProvider,
  JourneyStepRenderer
} from "@rxova/journey-react";

type StepId = "edit" | "confirmExit";
type Ctx = { dirty: boolean };

const Edit = () => {
  const { api } = useJourney<Ctx, StepId>();
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
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.close()}>Confirm close</button>;
};

export const confirmExitJourney: JourneyReactDefinition<Ctx, StepId> = {
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
      to: JOURNEY_TERMINAL.CLOSE,
      when: ({ context }) => !context.dirty
    }
  ]
};

export const ConfirmCloseExample = () => (
  <JourneyProvider journey={confirmExitJourney}>
    <JourneyStepRenderer<Ctx, StepId> />
  </JourneyProvider>
);
