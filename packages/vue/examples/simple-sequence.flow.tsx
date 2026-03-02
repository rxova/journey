import { defineComponent } from "vue";

import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "s1" | "s2";
type Ctx = Record<string, never>;

const S1 = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Continue</button>`
});

const S2 = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.completeJourney();
    return { onClick };
  },
  template: `<button @click="onClick">Done</button>`
});

export const simpleSequenceJourney: JourneyVueDefinition<Ctx, StepId> = {
  initial: "s1",
  context: {},
  steps: {
    s1: { component: S1 },
    s2: { component: S2 }
  },
  transitions: [
    { from: "s1", event: "goToNextStep", to: "s2" },
    { from: "s2", event: "completeJourney" }
  ]
};

const bindings = createJourneyBindings(simpleSequenceJourney);

export const SimpleSequenceJourneyExample = defineComponent({
  components: { Provider: bindings.Provider, StepRenderer: bindings.StepRenderer },
  template: `<Provider><StepRenderer /></Provider>`
});
