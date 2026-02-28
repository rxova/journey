import React from "react";

import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "details" | "review";
type Ctx = { draftId: string | null };

const saveDraft = async () => "draft-123";

const Details = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Save draft</button>;
};
const Review = () => {
  const snapshot = bindings.useJourneySnapshot();
  return <div>Draft: {snapshot.context.draftId ?? "none"}</div>;
};

export const asyncEffectJourney: JourneyReactDefinition<Ctx, StepId> = {
  initial: "details",
  context: { draftId: null },
  steps: {
    details: { component: Details },
    review: { component: Review }
  },
  transitions: [
    {
      from: "details",
      event: "goToNextStep",
      to: "review",
      effect: async ({ context }) => ({ ...context, draftId: await saveDraft() })
    }
  ]
};

const bindings = createJourneyBindings(asyncEffectJourney);

export const AsyncEffectExample = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;

  return (
    <Provider>
      <StepRenderer />
    </Provider>
  );
};
