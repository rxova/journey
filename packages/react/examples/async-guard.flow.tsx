import { createJourney } from "@rxova/journey-react";
import { asyncGuardJourney } from "../../core/examples/async-guard.flow";

export { asyncGuardJourney } from "../../core/examples/async-guard.flow";

const journey = createJourney(asyncGuardJourney);

const Validate = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Check token</button>;
};
const Blocked = () => <div>Blocked</div>;
const Allowed = () => <div>Allowed</div>;
const views = {
  validate: Validate,
  blocked: Blocked,
  allowed: Allowed
};

export const AsyncGuardExample = () => {
  return (
    <journey.JourneyProvider views={views}>
      <journey.StepRenderer />
    </journey.JourneyProvider>
  );
};
