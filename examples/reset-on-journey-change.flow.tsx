import React from "react";

import {
  JOURNEY_TERMINAL,
  type JourneyReactDefinition,
  useJourney,
  JourneyProvider,
  JourneyStepRenderer
} from "../src";

type StepId = "start" | "review";
type Ctx = { label: string };

const Start = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.next()}>Next</button>;
};

const Review = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.submit()}>Submit</button>;
};

const buildJourney = (label: string, initial: StepId): JourneyReactDefinition<Ctx, StepId> => ({
  initial,
  context: { label },
  steps: {
    start: { component: Start },
    review: { component: Review }
  },
  transitions: [
    { from: "start", event: "next", to: "review" },
    { from: "review", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
});

export const ResetOnJourneyChangeExample = () => {
  const [variant, setVariant] = React.useState<"A" | "B">("A");

  const journey = React.useMemo(
    () =>
      variant === "A" ? buildJourney("Variant A", "start") : buildJourney("Variant B", "review"),
    [variant]
  );

  return (
    <div>
      <button onClick={() => setVariant((value) => (value === "A" ? "B" : "A"))}>
        Switch to {variant === "A" ? "Variant B" : "Variant A"}
      </button>
      <p>
        This uses resetOnJourneyChange, so switching variants intentionally recreates the internal
        machine and resets state.
      </p>
      <JourneyProvider journey={journey} resetOnJourneyChange>
        <JourneyStepRenderer<Ctx, StepId> />
      </JourneyProvider>
    </div>
  );
};
