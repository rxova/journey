import {
  createJourneyMachine,
  HISTORY_TARGET,
  JOURNEY_TERMINAL,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = "destination" | "dates" | "lodging" | "itinerary" | "confirmExit";
type Event = "next" | "back" | "close" | "submit";

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

export const createItineraryBuilderMachine = () =>
  createJourneyMachine<ItineraryContext, StepId, Event>(itineraryBuilderJourney);
