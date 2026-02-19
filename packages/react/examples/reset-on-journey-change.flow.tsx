import React from "react";

import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "start" | "review";
type Ctx = { label: string };

const Start = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Next</button>;
};

const Review = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.completeJourney()}>Submit</button>;
};

const buildJourney = (label: string, initial: StepId): JourneyReactDefinition<Ctx, StepId> => ({
  initial,
  context: { label },
  steps: {
    start: { component: Start },
    review: { component: Review }
  },
  transitions: [
    { from: "start", event: "goToNextStep", to: "review" },
    { from: "review", event: "completeJourney" }
  ]
});

const bindings = createJourneyBindings(buildJourney("Variant A", "start"));

export const ResetOnJourneyChangeExample = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;
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
      <Provider journey={journey} resetOnJourneyChange>
        <StepRenderer />
      </Provider>
    </div>
  );
};
