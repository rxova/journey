import { createJourney } from "@rxova/journey-react";
import { customEventJourney } from "../../core/examples/custom-event.flow";

export { customEventJourney } from "../../core/examples/custom-event.flow";

const journey = createJourney(customEventJourney);

const Idle = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.send({ type: "retry" })}>Retry</button>;
};
const Failed = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.send({ type: "retry" })}>Retry</button>;
};
const Done = () => <div>Done</div>;
const views = {
  idle: Idle,
  failed: Failed,
  done: Done
};

export const CustomEventExample = () => {
  return (
    <journey.JourneyProvider views={views}>
      <journey.StepRenderer />
    </journey.JourneyProvider>
  );
};
