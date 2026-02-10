import React from "react";

import {
  type JourneyReactDefinition,
  useJourney,
  JourneyProvider,
  JourneyStepRenderer
} from "@rxova/journey-react";

type StepId = "details" | "review";
type Ctx = { draftId: string | null };

const saveDraft = async () => "draft-123";

const Details = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.next()}>Save draft</button>;
};
const Review = () => {
  const { snapshot } = useJourney<Ctx, StepId>();
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
      event: "next",
      to: "review",
      effect: async ({ context }) => ({ ...context, draftId: await saveDraft() })
    }
  ]
};

export const AsyncEffectExample = () => (
  <JourneyProvider journey={asyncEffectJourney}>
    <JourneyStepRenderer<Ctx, StepId> />
  </JourneyProvider>
);
