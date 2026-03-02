import { defineComponent } from "vue";

import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "start" | "first" | "second";
type Ctx = { chooseFirst: boolean };

const Start = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Next</button>`
});
const First = defineComponent({
  template: `<div>First</div>`
});
const Second = defineComponent({
  template: `<div>Second</div>`
});

export const firstMatchWinsJourney: JourneyVueDefinition<Ctx, StepId> = {
  initial: "start",
  context: { chooseFirst: true },
  steps: {
    start: { component: Start },
    first: { component: First },
    second: { component: Second }
  },
  transitions: [
    {
      id: "first",
      from: "start",
      event: "goToNextStep",
      to: "first",
      when: ({ context }) => context.chooseFirst
    },
    {
      id: "second",
      from: "start",
      event: "goToNextStep",
      to: "second",
      when: ({ context }) => context.chooseFirst
    }
  ]
};

const bindings = createJourneyBindings(firstMatchWinsJourney);

export const FirstMatchWinsExample = defineComponent({
  components: { Provider: bindings.Provider, StepRenderer: bindings.StepRenderer },
  template: `<Provider><StepRenderer /></Provider>`
});
