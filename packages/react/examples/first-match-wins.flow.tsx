import React from "react";

import {
  type JourneyReactDefinition,
  useJourney,
  JourneyProvider,
  JourneyStepRenderer
} from "@rxova/journey-react";

type StepId = "start" | "first" | "second";
type Ctx = { chooseFirst: boolean };

const Start = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.next()}>Next</button>;
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
      event: "next",
      to: "first",
      when: ({ context }) => context.chooseFirst
    },
    {
      id: "second",
      from: "start",
      event: "next",
      to: "second",
      when: ({ context }) => context.chooseFirst
    }
  ]
};

export const FirstMatchWinsExample = () => (
  <JourneyProvider journey={firstMatchWinsJourney}>
    <JourneyStepRenderer<Ctx, StepId> />
  </JourneyProvider>
);
