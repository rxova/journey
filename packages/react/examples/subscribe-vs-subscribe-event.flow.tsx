import React from "react";

import { createJourney } from "@rxova/journey-react";
import { subscribeJourney } from "../../core/examples/subscribe-vs-subscribe-event.flow";

export { subscribeJourney } from "../../core/examples/subscribe-vs-subscribe-event.flow";

const journey = createJourney(subscribeJourney);

const Start = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => void api.goToNextStep()}>Next</button>;
};

const Review = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => void api.goToNextStep()}>Next</button>;
};

const Done = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => void api.completeJourney()}>Submit</button>;
};
const views = {
  start: Start,
  review: Review,
  done: Done
};

const SubscriptionsPanel = () => {
  const snapshot = journey.useJourneySnapshot();
  const [eventTypes, setEventTypes] = React.useState<string[]>([]);

  journey.useJourneyEvent((event) => {
    setEventTypes((current) => [...current, event.type]);
  });

  return (
    <section>
      <div>
        Current step from `useJourneySnapshot` (machine.subscribe): {snapshot.currentStepId}
      </div>
      <div>Lifecycle events from `useJourneyEvent`: {eventTypes.join(", ") || "none yet"}</div>
    </section>
  );
};

export const SubscribeVsSubscribeEventExample = () => {
  return (
    <journey.JourneyProvider views={views}>
      <SubscriptionsPanel />
      <journey.StepRenderer />
    </journey.JourneyProvider>
  );
};
