import { computed, defineComponent, ref } from "vue";

import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "start" | "review";
type Ctx = { label: string };

const Start = defineComponent({
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

const buildJourney = (label: string, initial: StepId): JourneyVueDefinition<Ctx, StepId> => ({
  initial,
  context: { label },
  steps: {
    start: { component: Start },
    review: { component: Review }
  },
  transitions: [
    { from: "start", event: "goToNextStep", to: "review" },
    { from: "review", event: "completeJourney" }
  ]
});

const bindings = createJourneyBindings(buildJourney("Variant A", "start"));

export const ResetOnJourneyChangeExample = defineComponent({
  components: { Provider: bindings.Provider, StepRenderer: bindings.StepRenderer },
  setup() {
    const variant = ref<"A" | "B">("A");
    const journey = computed(() =>
      variant.value === "A"
        ? buildJourney("Variant A", "start")
        : buildJourney("Variant B", "review")
    );
    const toggleVariant = () => {
      variant.value = variant.value === "A" ? "B" : "A";
    };
    return { journey, toggleVariant, variant };
  },
  template:
    `<div>` +
    `<button @click="toggleVariant">Switch to {{ variant === "A" ? "Variant B" : "Variant A" }}</button>` +
    `<p>This uses resetOnJourneyChange, so switching variants intentionally recreates the internal machine and resets state.</p>` +
    `<Provider :journey="journey" :resetOnJourneyChange="true"><StepRenderer /></Provider>` +
    `</div>`
});
