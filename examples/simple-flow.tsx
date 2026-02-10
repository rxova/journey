import React from "react";

import {
  JOURNEY_TERMINAL,
  type JourneyReactDefinition,
  useJourney,
  JourneyProvider,
  JourneyStepRenderer
} from "../src";

type StepId = "one" | "two" | "three";
type Ctx = { name: string };

const One = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.next()}>Next</button>;
};

const Two = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.next()}>Next</button>;
};

const Three = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.submit()}>Finish</button>;
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
    { from: "one", event: "next", to: "two" },
    { from: "two", event: "next", to: "three" },
    { from: "three", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};

export const SimpleJourneyExample = () => (
  <JourneyProvider journey={simpleJourney}>
    <JourneyStepRenderer<Ctx, StepId> />
  </JourneyProvider>
);
