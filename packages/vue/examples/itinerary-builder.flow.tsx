import { defineComponent } from "vue";

import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "destination" | "dates" | "lodging" | "itinerary" | "confirmExit";
type CustomEvent = "requestClose";

type ItineraryContext = {
  flexibleDates: boolean;
  needsLodging: boolean;
  dirty: boolean;
};

const Destination = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Pick destination</button>`
});

const Dates = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Save dates</button>`
});

const Lodging = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Choose lodging</button>`
});

const Itinerary = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.completeJourney();
    return { onClick };
  },
  template: `<button @click="onClick">Finalize itinerary</button>`
});

const ConfirmExit = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.terminateJourney();
    return { onClick };
  },
  template: `<button @click="onClick">Confirm exit</button>`
});

export const itineraryBuilderJourney: JourneyVueDefinition<ItineraryContext, StepId, CustomEvent> =
  {
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

export const ItineraryBuilderExample = defineComponent({
  components: { Provider: bindings.Provider, StepRenderer: bindings.StepRenderer },
  template: `<Provider><StepRenderer /></Provider>`
});
