import { createJourney } from "@rxova/journey-react";
import { firstMatchWinsJourney } from "../../core/examples/first-match-wins.flow";

export { firstMatchWinsJourney } from "../../core/examples/first-match-wins.flow";

const journey = createJourney(firstMatchWinsJourney);

const Start = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Next</button>;
};
const First = () => <div>First</div>;
const Second = () => <div>Second</div>;
const views = {
  start: Start,
  first: First,
  second: Second
};

export const FirstMatchWinsExample = () => {
  return (
    <journey.JourneyProvider views={views}>
      <journey.StepRenderer />
    </journey.JourneyProvider>
  );
};
