import React from "react";

import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "idle" | "failed" | "done";
type CustomEvent = "retry";
type Ctx = { tries: number };

const Idle = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.send({ type: "retry" })}>Retry</button>;
};
const Failed = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.send({ type: "retry" })}>Retry</button>;
};
const Done = () => <div>Done</div>;

export const customEventJourney: JourneyReactDefinition<Ctx, StepId, CustomEvent> = {
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

const bindings = createJourneyBindings(customEventJourney);

export const CustomEventExample = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;

  return (
    <Provider>
      <StepRenderer />
    </Provider>
  );
};
