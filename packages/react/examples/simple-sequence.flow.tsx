import { createJourney } from "@rxova/journey-react";
import { simpleSequenceJourney } from "../../core/examples/simple-sequence.flow";

export { simpleSequenceJourney } from "../../core/examples/simple-sequence.flow";

const journey = createJourney(simpleSequenceJourney);

const S1 = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Continue</button>;
};

const S2 = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.completeJourney()}>Done</button>;
};
const views = {
  s1: S1,
  s2: S2
};

export const SimpleSequenceJourneyExample = () => {
  return (
    <journey.JourneyProvider views={views}>
      <journey.StepRenderer />
    </journey.JourneyProvider>
  );
};
