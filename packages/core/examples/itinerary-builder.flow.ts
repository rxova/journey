import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "destination" | "dates" | "lodging" | "itinerary" | "confirmExit";
type EventMap = { back: unknown; requestClose: unknown };

type ItineraryContext = {
  flexibleDates: boolean;
  needsLodging: boolean;
  dirty: boolean;
};

export const itineraryBuilderJourney: JourneyDefinition<ItineraryContext, StepId, EventMap> = {
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
  transitions: {
    destination: {
      goToNextStep: [
        { to: "dates", when: ({ context }) => context.flexibleDates },
        {
          to: "lodging",
          when: ({ context }) => !context.flexibleDates && context.needsLodging
        },
        {
          to: "itinerary",
          when: ({ context }) => !context.flexibleDates && !context.needsLodging
        }
      ]
    },
    dates: {
      goToNextStep: [
        { to: "lodging", when: ({ context }) => context.needsLodging },
        { to: "itinerary", when: ({ context }) => !context.needsLodging }
      ]
    },
    lodging: { goToNextStep: [{ to: "itinerary" }] },
    itinerary: { completeJourney: [{}] },
    global: {
      requestClose: [
        {
          to: "confirmExit",
          when: ({ context }) => context.dirty
        }
      ],
      terminateJourney: [{}]
    }
  }
};

export const createItineraryBuilderMachine = () => createJourneyMachine(itineraryBuilderJourney);
