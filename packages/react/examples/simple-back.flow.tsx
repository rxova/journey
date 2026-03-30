import { createJourney } from "@rxova/journey-react";
import { simpleBackJourney } from "../../core/examples/simple-back.flow";

export { simpleBackJourney } from "../../core/examples/simple-back.flow";

const journey = createJourney(simpleBackJourney);

const One = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Go</button>;
};

const Two = () => {
  const api = journey.useJourneyApi();
  return (
    <div>
      <button onClick={() => api.goToPreviousStep()}>Back</button>
      <button onClick={() => api.goToNextStep()}>Next</button>
    </div>
  );
};

const Three = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToPreviousStep()}>Back</button>;
};
const views = {
  one: One,
  two: Two,
  three: Three
};

export const SimpleBackJourneyExample = () => {
  return (
    <journey.JourneyProvider views={views}>
      <journey.StepRenderer />
    </journey.JourneyProvider>
  );
};
