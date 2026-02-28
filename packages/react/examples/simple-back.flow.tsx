import React from "react";

import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "one" | "two" | "three";
type Ctx = Record<string, never>;

const One = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Go</button>;
};

const Two = () => {
  const api = bindings.useJourneyApi();
  return (
    <div>
      <button onClick={() => api.goToPreviousStep()}>Back</button>
      <button onClick={() => api.goToNextStep()}>Next</button>
    </div>
  );
};

const Three = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToPreviousStep()}>Back</button>;
};

export const simpleBackJourney: JourneyReactDefinition<Ctx, StepId> = {
  initial: "one",
  context: {},
  steps: {
    one: { component: One },
    two: { component: Two },
    three: { component: Three }
  },
  transitions: [
    { from: "one", event: "goToNextStep", to: "two" },
    { from: "two", event: "goToNextStep", to: "three" }
  ]
};

const bindings = createJourneyBindings(simpleBackJourney);

export const SimpleBackJourneyExample = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;

  return (
    <Provider>
      <StepRenderer />
    </Provider>
  );
};
