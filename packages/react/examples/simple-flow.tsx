import React from "react";

import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "one" | "two" | "three";
type Ctx = { name: string };

const One = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Next</button>;
};

const Two = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Next</button>;
};

const Three = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.completeJourney()}>Finish</button>;
};

export const simpleJourney: JourneyReactDefinition<Ctx, StepId> = {
  initial: "one",
  context: { name: "" },
  steps: {
    one: { component: One },
    two: { component: Two },
    three: { component: Three }
  },
  transitions: [
    { from: "one", event: "goToNextStep", to: "two" },
    { from: "two", event: "goToNextStep", to: "three" },
    { from: "three", event: "completeJourney" }
  ]
};

const bindings = createJourneyBindings(simpleJourney);

export const SimpleJourneyExample = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;

  return (
    <Provider>
      <StepRenderer />
    </Provider>
  );
};
