import { createJourney } from "@rxova/journey-react";
import { simpleJourney } from "../../core/examples/simple-flow.flow";

export { simpleJourney } from "../../core/examples/simple-flow.flow";

const journey = createJourney(simpleJourney);

const One = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Next</button>;
};

const Two = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Next</button>;
};

const Three = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.completeJourney()}>Finish</button>;
};
const views = {
  one: One,
  two: Two,
  three: Three
};

export const SimpleJourneyExample = () => {
  return (
    <journey.JourneyProvider views={views}>
      <journey.StepRenderer />
    </journey.JourneyProvider>
  );
};
