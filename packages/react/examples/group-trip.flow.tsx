import { createJourney } from "@rxova/journey-react";
import { groupTripJourney } from "../../core/examples/group-trip.flow";

export { groupTripJourney } from "../../core/examples/group-trip.flow";

const journey = createJourney(groupTripJourney);

const Invitees = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Invite travelers</button>;
};

const Preferences = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Save preferences</button>;
};

const Budget = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Set budget</button>;
};

const ConfirmPlan = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.completeJourney()}>Confirm plan</button>;
};
const views = {
  invitees: Invitees,
  preferences: Preferences,
  budget: Budget,
  confirmPlan: ConfirmPlan
};

export const GroupTripExample = () => {
  return (
    <journey.JourneyProvider views={views}>
      <journey.StepRenderer />
    </journey.JourneyProvider>
  );
};
