import { defineComponent } from "vue";

import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "start" | "branchA" | "branchB" | "review";
type Ctx = { branch: "A" | "B" };

const Start = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Next</button>`
});
const BranchA = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">To review</button>`
});
const BranchB = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">To review</button>`
});
const Review = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToPreviousStep();
    return { onClick };
  },
  template: `<button @click="onClick">Back by history</button>`
});

export const historyBackJourney: JourneyVueDefinition<Ctx, StepId> = {
  initial: "start",
  context: { branch: "A" },
  steps: {
    start: { component: Start },
    branchA: { component: BranchA },
    branchB: { component: BranchB },
    review: { component: Review }
  },
  transitions: [
    {
      from: "start",
      event: "goToNextStep",
      to: "branchA",
      when: ({ context }) => context.branch === "A"
    },
    {
      from: "start",
      event: "goToNextStep",
      to: "branchB",
      when: ({ context }) => context.branch === "B"
    },
    { from: "branchA", event: "goToNextStep", to: "review" },
    { from: "branchB", event: "goToNextStep", to: "review" }
  ]
};

const bindings = createJourneyBindings(historyBackJourney);

export const HistoryBackExample = defineComponent({
  components: { Provider: bindings.Provider, StepRenderer: bindings.StepRenderer },
  template: `<Provider><StepRenderer /></Provider>`
});
