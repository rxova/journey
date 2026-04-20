import { createJourney } from "@rxova/journey-react";
import { asyncEffectJourney } from "../../core/examples/async-transition-update.flow";

export { asyncEffectJourney } from "../../core/examples/async-transition-update.flow";

const journey = createJourney(asyncEffectJourney);

const Details = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Save draft</button>;
};
const Review = () => {
  const snapshot = journey.useJourneySnapshot();
  return <div>Draft: {snapshot.context.draftId ?? "none"}</div>;
};
const views = {
  details: Details,
  review: Review
};

export const AsyncEffectExample = () => {
  return (
    <journey.JourneyProvider views={views}>
      <journey.StepRenderer />
    </journey.JourneyProvider>
  );
};
