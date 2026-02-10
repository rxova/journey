import React from "react";

import {
  JOURNEY_TERMINAL,
  type JourneyReactDefinition,
  useJourney,
  JourneyProvider,
  JourneyStepRenderer
} from "../src";

type StepId = "start" | "optional" | "review";
type Ctx = { includeOptional: boolean };

const Start = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.next()}>Next</button>;
};
const Optional = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.next()}>Next</button>;
};
const Review = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.submit()}>Submit</button>;
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
      event: "next",
      to: "optional",
      when: ({ context }) => context.includeOptional
    },
    {
      from: "start",
      event: "next",
      to: "review",
      when: ({ context }) => !context.includeOptional
    },
    { from: "optional", event: "next", to: "review" },
    { from: "review", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};

export const ConditionalSkipExample = () => (
  <JourneyProvider journey={conditionalSkipJourney}>
    <JourneyStepRenderer<Ctx, StepId> />
  </JourneyProvider>
);
