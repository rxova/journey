import { createJourney } from "@rxova/journey-react";
import { conditionalSkipJourney } from "../../core/examples/conditional-skip.flow";

export { conditionalSkipJourney } from "../../core/examples/conditional-skip.flow";

const journey = createJourney(conditionalSkipJourney);

const Start = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Next</button>;
};
const Optional = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Next</button>;
};
const Review = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.completeJourney()}>Submit</button>;
};
const views = {
  start: Start,
  optional: Optional,
  review: Review
};

export const ConditionalSkipExample = () => {
  return (
    <journey.JourneyProvider views={views}>
      <journey.StepRenderer />
    </journey.JourneyProvider>
  );
};
