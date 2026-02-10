import React from "react";

import {
  HISTORY_TARGET,
  type JourneyReactDefinition,
  useJourney,
  JourneyProvider,
  JourneyStepRenderer
} from "../src";

type StepId = "one" | "two" | "three";
type Ctx = Record<string, never>;

const One = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.next()}>Go</button>;
};

const Two = () => {
  const { api } = useJourney<Ctx, StepId>();
  return (
    <div>
      <button onClick={() => api.back()}>Back</button>
      <button onClick={() => api.next()}>Next</button>
    </div>
  );
};

const Three = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.back()}>Back</button>;
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
    { from: "one", event: "next", to: "two" },
    { from: "two", event: "next", to: "three" },
    { from: "*", event: "back", to: HISTORY_TARGET }
  ]
};

export const SimpleBackJourneyExample = () => (
  <JourneyProvider journey={simpleBackJourney}>
    <JourneyStepRenderer<Ctx, StepId> />
  </JourneyProvider>
);
