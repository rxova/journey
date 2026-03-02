import { defineComponent } from "vue";

import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "one" | "two" | "three";
type Ctx = Record<string, never>;

const One = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Go</button>`
});

const Two = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onBack = () => void api.goToPreviousStep();
    const onNext = () => void api.goToNextStep();
    return { onBack, onNext };
  },
  template: `<div><button @click="onBack">Back</button><button @click="onNext">Next</button></div>`
});

const Three = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToPreviousStep();
    return { onClick };
  },
  template: `<button @click="onClick">Back</button>`
});

export const simpleBackJourney: JourneyVueDefinition<Ctx, StepId> = {
  initial: "one",
  context: {},
  steps: {
    one: { component: One },
    two: { component: Two },
    three: { component: Three }
  },
  transitions: [
    { from: "one", event: "goToNextStep", to: "two" },
    { from: "two", event: "goToNextStep", to: "three" }
  ]
};

const bindings = createJourneyBindings(simpleBackJourney);

export const SimpleBackJourneyExample = defineComponent({
  components: { Provider: bindings.Provider, StepRenderer: bindings.StepRenderer },
  template: `<Provider><StepRenderer /></Provider>`
});
