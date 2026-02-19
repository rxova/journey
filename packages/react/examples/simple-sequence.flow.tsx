import React from "react";

import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "s1" | "s2";
type Ctx = Record<string, never>;

const S1 = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Continue</button>;
};

const S2 = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.completeJourney()}>Done</button>;
};

export const simpleSequenceJourney: JourneyReactDefinition<Ctx, StepId> = {
  initial: "s1",
  context: {},
  steps: {
    s1: { component: S1 },
    s2: { component: S2 }
  },
  transitions: [
    { from: "s1", event: "goToNextStep", to: "s2" },
    { from: "s2", event: "completeJourney" }
  ]
};

const bindings = createJourneyBindings(simpleSequenceJourney);

export const SimpleSequenceJourneyExample = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;

  return (
    <Provider>
      <StepRenderer />
    </Provider>
  );
};
