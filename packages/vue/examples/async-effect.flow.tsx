import { defineComponent } from "vue";

import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "details" | "review";
type Ctx = { draftId: string | null };

const saveDraft = async () => "draft-123";

const Details = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Save draft</button>`
});

const Review = defineComponent({
  setup() {
    const snapshot = bindings.useJourneySnapshot();
    return { snapshot };
  },
  template: `<div>Draft: {{ snapshot.context.draftId ?? "none" }}</div>`
});

export const asyncEffectJourney: JourneyVueDefinition<Ctx, StepId> = {
  initial: "details",
  context: { draftId: null },
  steps: {
    details: { component: Details },
    review: { component: Review }
  },
  transitions: [
    {
      from: "details",
      event: "goToNextStep",
      to: "review",
      effect: async ({ context }) => ({ ...context, draftId: await saveDraft() })
    }
  ]
};

const bindings = createJourneyBindings(asyncEffectJourney);

export const AsyncEffectExample = defineComponent({
  components: { Provider: bindings.Provider, StepRenderer: bindings.StepRenderer },
  template: `<Provider><StepRenderer /></Provider>`
});
