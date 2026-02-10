import React from "react";

import {
  JOURNEY_TERMINAL,
  type JourneyReactDefinition,
  useJourney,
  JourneyProvider,
  JourneyStepRenderer
} from "@rxova/journey-react";

type StepId = "s1" | "s2";
type Ctx = Record<string, never>;

const S1 = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.next()}>Continue</button>;
};

const S2 = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.submit()}>Done</button>;
};

export const simpleSequenceJourney: JourneyReactDefinition<Ctx, StepId> = {
  initial: "s1",
  context: {},
  steps: {
    s1: { component: S1 },
    s2: { component: S2 }
  },
  transitions: [
    { from: "s1", event: "next", to: "s2" },
    { from: "s2", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};

export const SimpleSequenceJourneyExample = () => (
  <JourneyProvider journey={simpleSequenceJourney}>
    <JourneyStepRenderer<Ctx, StepId> />
  </JourneyProvider>
);
