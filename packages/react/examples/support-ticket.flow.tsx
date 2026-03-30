import { createJourney } from "@rxova/journey-react";
import { supportTicketJourney } from "../../core/examples/support-ticket.flow";

export { supportTicketJourney } from "../../core/examples/support-ticket.flow";

const journey = createJourney(supportTicketJourney);

const Category = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Continue</button>;
};

const Details = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Continue</button>;
};

const Screenshot = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Continue</button>;
};

const Review = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.completeJourney()}>Submit</button>;
};

const ConfirmExit = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.terminateJourney()}>Discard</button>;
};
const views = {
  category: Category,
  details: Details,
  screenshot: Screenshot,
  review: Review,
  confirmExit: ConfirmExit
};

export const SupportTicketExample = () => {
  return (
    <journey.JourneyProvider views={views}>
      <journey.StepRenderer />
    </journey.JourneyProvider>
  );
};
