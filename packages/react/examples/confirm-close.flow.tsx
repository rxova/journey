import React from "react";

import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "edit" | "confirmExit";
type Event = "requestClose";
type Ctx = { dirty: boolean };

const Edit = () => {
  const snapshot = bindings.useJourneySnapshot();
  const api = bindings.useJourneyApi();
  return (
    <div>
      <button onClick={() => api.updateContext((ctx) => ({ ...ctx, dirty: true }))}>
        Make dirty
      </button>
      <button
        onClick={() =>
          snapshot.context.dirty ? api.send({ type: "requestClose" }) : api.terminateJourney()
        }
      >
        Close
      </button>
    </div>
  );
};

const ConfirmExit = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.terminateJourney()}>Confirm close</button>;
};

export const confirmExitJourney: JourneyReactDefinition<Ctx, StepId, Event> = {
  initial: "edit",
  context: { dirty: false },
  steps: {
    edit: { component: Edit },
    confirmExit: { component: ConfirmExit }
  },
  transitions: [
    {
      from: "*",
      event: "requestClose",
      to: "confirmExit",
      when: ({ context }) => context.dirty
    },
    { from: "*", event: "terminateJourney" }
  ]
};

const bindings = createJourneyBindings(confirmExitJourney);

export const ConfirmExitExample = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;

  return (
    <Provider>
      <StepRenderer />
    </Provider>
  );
};
