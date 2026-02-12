import React from "react";

import {
  HISTORY_TARGET,
  JOURNEY_TERMINAL,
  type JourneyReactDefinition,
  useJourney,
  JourneyProvider,
  JourneyStepRenderer
} from "@rxova/journey-react";

type StepId = "destination" | "dates" | "lodging" | "itinerary" | "confirmExit";
type Event = "next" | "back" | "close" | "submit";

type ItineraryContext = {
  flexibleDates: boolean;
  needsLodging: boolean;
  dirty: boolean;
};

const Destination = () => {
  const { api } = useJourney<ItineraryContext, StepId, Event>();
  return <button onClick={() => api.next()}>Pick destination</button>;
};

const Dates = () => {
  const { api } = useJourney<ItineraryContext, StepId, Event>();
  return <button onClick={() => api.next()}>Save dates</button>;
};

const Lodging = () => {
  const { api } = useJourney<ItineraryContext, StepId, Event>();
  return <button onClick={() => api.next()}>Choose lodging</button>;
};

const Itinerary = () => {
  const { api } = useJourney<ItineraryContext, StepId, Event>();
  return <button onClick={() => api.submit()}>Finalize itinerary</button>;
};

const ConfirmExit = () => {
  const { api } = useJourney<ItineraryContext, StepId, Event>();
  return <button onClick={() => api.close()}>Confirm exit</button>;
};

export const itineraryBuilderJourney: JourneyReactDefinition<ItineraryContext, StepId, Event> = {
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
      event: "next",
      to: "dates",
      when: ({ context }) => context.flexibleDates
    },
    {
      from: "destination",
      event: "next",
      to: "lodging",
      when: ({ context }) => !context.flexibleDates && context.needsLodging
    },
    {
      from: "destination",
      event: "next",
      to: "itinerary",
      when: ({ context }) => !context.flexibleDates && !context.needsLodging
    },
    {
      from: "dates",
      event: "next",
      to: "lodging",
      when: ({ context }) => context.needsLodging
    },
    {
      from: "dates",
      event: "next",
      to: "itinerary",
      when: ({ context }) => !context.needsLodging
    },
    { from: "lodging", event: "next", to: "itinerary" },
    { from: "*", event: "back", to: HISTORY_TARGET },
    {
      from: "*",
      event: "close",
      to: "confirmExit",
      when: ({ context }) => context.dirty
    },
    {
      from: "*",
      event: "close",
      to: JOURNEY_TERMINAL.CLOSE,
      when: ({ context }) => !context.dirty
    },
    { from: "itinerary", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};

export const ItineraryBuilderExample = () => (
  <JourneyProvider journey={itineraryBuilderJourney}>
    <JourneyStepRenderer<ItineraryContext, StepId, Event> />
  </JourneyProvider>
);
