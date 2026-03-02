import { defineComponent } from "vue";

import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "category" | "details" | "screenshot" | "review" | "confirmExit";
type Event = "requestClose";
type Ctx = {
  includeScreenshot: boolean;
  dirty: boolean;
};

const Category = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Continue</button>`
});

const Details = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Continue</button>`
});

const Screenshot = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Continue</button>`
});

const Review = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.completeJourney();
    return { onClick };
  },
  template: `<button @click="onClick">Submit</button>`
});

const ConfirmExit = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.terminateJourney();
    return { onClick };
  },
  template: `<button @click="onClick">Discard</button>`
});

export const supportTicketJourney: JourneyVueDefinition<Ctx, StepId, Event> = {
  initial: "category",
  context: {
    includeScreenshot: false,
    dirty: false
  },
  steps: {
    category: { component: Category },
    details: { component: Details },
    screenshot: { component: Screenshot },
    review: { component: Review },
    confirmExit: { component: ConfirmExit }
  },
  transitions: [
    { from: "category", event: "goToNextStep", to: "details" },
    {
      from: "details",
      event: "goToNextStep",
      to: "screenshot",
      when: ({ context }) => context.includeScreenshot
    },
    {
      from: "details",
      event: "goToNextStep",
      to: "review",
      when: ({ context }) => !context.includeScreenshot
    },
    { from: "screenshot", event: "goToNextStep", to: "review" },
    {
      from: "*",
      event: "requestClose",
      to: "confirmExit",
      when: ({ context }) => context.dirty
    },
    { from: "*", event: "terminateJourney" },
    { from: "review", event: "completeJourney" }
  ]
};

const bindings = createJourneyBindings(supportTicketJourney);

export const SupportTicketExample = defineComponent({
  components: { Provider: bindings.Provider, StepRenderer: bindings.StepRenderer },
  template: `<Provider><StepRenderer /></Provider>`
});
