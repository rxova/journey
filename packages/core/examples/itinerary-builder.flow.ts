import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "destination" | "dates" | "lodging" | "itinerary" | "confirmExit";
type Event = "goToNextStep" | "back" | "requestClose" | "terminateJourney" | "completeJourney";

type ItineraryContext = {
  flexibleDates: boolean;
  needsLodging: boolean;
  dirty: boolean;
};

export const itineraryBuilderJourney: JourneyDefinition<ItineraryContext, StepId, Event> = {
  initial: "destination",
  context: {
    flexibleDates: false,
    needsLodging: false,
    dirty: false
  },
  steps: {
    destination: {},
    dates: {},
    lodging: {},
    itinerary: {},
    confirmExit: {}
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

export const createItineraryBuilderMachine = () =>
  createJourneyMachine<ItineraryContext, StepId, Event>(itineraryBuilderJourney);
