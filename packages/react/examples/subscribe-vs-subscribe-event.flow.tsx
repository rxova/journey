import React from "react";

import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "start" | "review" | "done";
type Ctx = { submitted: boolean };

let bindings: ReturnType<typeof createJourneyBindings<Ctx, StepId>>;

const Start = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => void api.goToNextStep()}>Next</button>;
};

const Review = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => void api.goToNextStep()}>Next</button>;
};

const Done = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => void api.completeJourney()}>Submit</button>;
};

const subscribeJourney: JourneyReactDefinition<Ctx, StepId> = {
  initial: "start",
  context: { submitted: false },
  steps: {
    start: { component: Start },
    review: { component: Review },
    done: { component: Done }
  },
  transitions: [
    { from: "start", event: "goToNextStep", to: "review" },
    {
      from: "review",
      event: "goToNextStep",
      to: "done",
      effect: ({ context }) => ({ ...context, submitted: true })
    },
    { from: "done", event: "completeJourney" }
  ]
};

bindings = createJourneyBindings(subscribeJourney);

const SubscriptionsPanel = () => {
  const snapshot = bindings.useJourneySnapshot();
  const machine = bindings.useJourneyMachine();
  const [eventTypes, setEventTypes] = React.useState<string[]>([]);

  React.useEffect(() => {
    const unsubscribeEvents = machine.subscribeEvent((event) => {
      setEventTypes((current) => [...current, event.type]);
    });

    return unsubscribeEvents;
  }, [machine]);

  return (
    <section>
      <div>
        Current step from `useJourneySnapshot` (machine.subscribe): {snapshot.currentStepId}
      </div>
      <div>
        Lifecycle events from `machine.subscribeEvent`: {eventTypes.join(", ") || "none yet"}
      </div>
    </section>
  );
};

export const SubscribeVsSubscribeEventExample = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;

  return (
    <Provider>
      <SubscriptionsPanel />
      <StepRenderer />
    </Provider>
  );
};
