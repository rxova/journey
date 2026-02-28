import React from "react";

import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "start" | "first" | "second";
type Ctx = { chooseFirst: boolean };

const Start = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Next</button>;
};
const First = () => <div>First</div>;
const Second = () => <div>Second</div>;

export const firstMatchWinsJourney: JourneyReactDefinition<Ctx, StepId> = {
  initial: "start",
  context: { chooseFirst: true },
  steps: {
    start: { component: Start },
    first: { component: First },
    second: { component: Second }
  },
  transitions: [
    {
      id: "first",
      from: "start",
      event: "goToNextStep",
      to: "first",
      when: ({ context }) => context.chooseFirst
    },
    {
      id: "second",
      from: "start",
      event: "goToNextStep",
      to: "second",
      when: ({ context }) => context.chooseFirst
    }
  ]
};

const bindings = createJourneyBindings(firstMatchWinsJourney);

export const FirstMatchWinsExample = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;

  return (
    <Provider>
      <StepRenderer />
    </Provider>
  );
};
