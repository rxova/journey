import { createJourney } from "@rxova/journey-react";
import { itineraryBuilderJourney } from "../../core/examples/itinerary-builder.flow";

export { itineraryBuilderJourney } from "../../core/examples/itinerary-builder.flow";

const journey = createJourney(itineraryBuilderJourney);

const Destination = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Pick destination</button>;
};

const Dates = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Save dates</button>;
};

const Lodging = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Choose lodging</button>;
};

const Itinerary = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.completeJourney()}>Finalize itinerary</button>;
};

const ConfirmExit = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.terminateJourney()}>Confirm exit</button>;
};
const views = {
  destination: Destination,
  dates: Dates,
  lodging: Lodging,
  itinerary: Itinerary,
  confirmExit: ConfirmExit
};

export const ItineraryBuilderExample = () => {
  return (
    <journey.JourneyProvider views={views}>
      <journey.StepRenderer />
    </journey.JourneyProvider>
  );
};
