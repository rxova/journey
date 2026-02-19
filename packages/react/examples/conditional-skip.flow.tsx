import React from "react";

import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "start" | "optional" | "review";
type Ctx = { includeOptional: boolean };

const Start = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Next</button>;
};
const Optional = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Next</button>;
};
const Review = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.completeJourney()}>Submit</button>;
};

export const conditionalSkipJourney: JourneyReactDefinition<Ctx, StepId> = {
  initial: "start",
  context: { includeOptional: false },
  steps: {
    start: { component: Start },
    optional: { component: Optional },
    review: { component: Review }
  },
  transitions: [
    {
      from: "start",
      event: "goToNextStep",
      to: "optional",
      when: ({ context }) => context.includeOptional
    },
    {
      from: "start",
      event: "goToNextStep",
      to: "review",
      when: ({ context }) => !context.includeOptional
    },
    { from: "optional", event: "goToNextStep", to: "review" },
    { from: "review", event: "completeJourney" }
  ]
};

const bindings = createJourneyBindings(conditionalSkipJourney);

export const ConditionalSkipExample = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;

  return (
    <Provider>
      <StepRenderer />
    </Provider>
  );
};
