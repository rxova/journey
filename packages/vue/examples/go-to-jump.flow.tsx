import { defineComponent } from "vue";

import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "step1" | "step2" | "review";
type Event = "goToNextStep" | "jumpToReview";
type Ctx = Record<string, never>;

const Step1 = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.send({ type: "jumpToReview" });
    return { onClick };
  },
  template: `<button @click="onClick">Jump to review</button>`
});
const Step2 = defineComponent({
  template: `<div>Step 2</div>`
});
const Review = defineComponent({
  template: `<div>Review</div>`
});

export const goToJumpJourney: JourneyVueDefinition<Ctx, StepId, Event> = {
  initial: "step1",
  context: {},
  steps: {
    step1: { component: Step1 },
    step2: { component: Step2 },
    review: { component: Review }
  },
  transitions: [
    { from: "step1", event: "goToNextStep", to: "step2" },
    { from: "step1", event: "jumpToReview", to: "review" }
  ]
};

const bindings = createJourneyBindings(goToJumpJourney);

export const GoToJumpExample = defineComponent({
  components: { Provider: bindings.Provider, StepRenderer: bindings.StepRenderer },
  template: `<Provider><StepRenderer /></Provider>`
});
