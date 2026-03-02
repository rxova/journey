import { defineComponent } from "vue";

import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "one" | "two" | "three";
type Ctx = { name: string };

const One = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Next</button>`
});

const Two = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Next</button>`
});

const Three = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.completeJourney();
    return { onClick };
  },
  template: `<button @click="onClick">Finish</button>`
});

export const simpleJourney: JourneyVueDefinition<Ctx, StepId> = {
  initial: "one",
  context: { name: "" },
  steps: {
    one: { component: One },
    two: { component: Two },
    three: { component: Three }
  },
  transitions: [
    { from: "one", event: "goToNextStep", to: "two" },
    { from: "two", event: "goToNextStep", to: "three" },
    { from: "three", event: "completeJourney" }
  ]
};

const bindings = createJourneyBindings(simpleJourney);

export const SimpleJourneyExample = defineComponent({
  components: { Provider: bindings.Provider, StepRenderer: bindings.StepRenderer },
  template: `<Provider><StepRenderer /></Provider>`
});
