import React from "react";

import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "destination" | "dates" | "lodging" | "itinerary" | "confirmExit";
type CustomEvent = "requestClose";

type ItineraryContext = {
  flexibleDates: boolean;
  needsLodging: boolean;
  dirty: boolean;
};

const Destination = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Pick destination</button>;
};

const Dates = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Save dates</button>;
};

const Lodging = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Choose lodging</button>;
};

const Itinerary = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.completeJourney()}>Finalize itinerary</button>;
};

const ConfirmExit = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => api.terminateJourney()}>Confirm exit</button>;
};

export const itineraryBuilderJourney: JourneyReactDefinition<
  ItineraryContext,
  StepId,
  CustomEvent
> = {
  initial: "destination",
  context: {
    flexibleDates: false,
    needsLodging: false,
    dirty: false
  },
  steps: {
    destination: { component: Destination },
    dates: { component: Dates },
    lodging: { component: Lodging },
    itinerary: { component: Itinerary },
    confirmExit: { component: ConfirmExit }
  },
  transitions: [
    {
      from: "destination",
      event: "goToNextStep",
      to: "dates",
      when: ({ context }) => context.flexibleDates
    },
    {
      from: "destination",
      event: "goToNextStep",
      to: "lodging",
      when: ({ context }) => !context.flexibleDates && context.needsLodging
    },
    {
      from: "destination",
      event: "goToNextStep",
      to: "itinerary",
      when: ({ context }) => !context.flexibleDates && !context.needsLodging
    },
    {
      from: "dates",
      event: "goToNextStep",
      to: "lodging",
      when: ({ context }) => context.needsLodging
    },
    {
      from: "dates",
      event: "goToNextStep",
      to: "itinerary",
      when: ({ context }) => !context.needsLodging
    },
    { from: "lodging", event: "goToNextStep", to: "itinerary" },
    {
      from: "*",
      event: "requestClose",
      to: "confirmExit",
      when: ({ context }) => context.dirty
    },
    { from: "*", event: "terminateJourney" },
    { from: "itinerary", event: "completeJourney" }
  ]
};

const bindings = createJourneyBindings(itineraryBuilderJourney);

export const ItineraryBuilderExample = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;

  return (
    <Provider>
      <StepRenderer />
    </Provider>
  );
};
