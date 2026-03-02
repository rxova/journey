import { defineComponent } from "vue";

import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "start" | "optional" | "review";
type Ctx = { includeOptional: boolean };

const Start = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Next</button>`
});

const Optional = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Next</button>`
});

const Review = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.completeJourney();
    return { onClick };
  },
  template: `<button @click="onClick">Submit</button>`
});

export const conditionalSkipJourney: JourneyVueDefinition<Ctx, StepId> = {
  initial: "start",
  context: { includeOptional: false },
  steps: {
    start: { component: Start },
    optional: { component: Optional },
    review: { component: Review }
  },
  transitions: [
    {
      from: "start",
      event: "goToNextStep",
      to: "optional",
      when: ({ context }) => context.includeOptional
    },
    {
      from: "start",
      event: "goToNextStep",
      to: "review",
      when: ({ context }) => !context.includeOptional
    },
    { from: "optional", event: "goToNextStep", to: "review" },
    { from: "review", event: "completeJourney" }
  ]
};

const bindings = createJourneyBindings(conditionalSkipJourney);

export const ConditionalSkipExample = defineComponent({
  components: { Provider: bindings.Provider, StepRenderer: bindings.StepRenderer },
  template: `<Provider><StepRenderer /></Provider>`
});
