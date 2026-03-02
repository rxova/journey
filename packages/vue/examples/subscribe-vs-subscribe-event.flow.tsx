import { defineComponent, onUnmounted, ref } from "vue";

import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "start" | "review" | "done";
type Ctx = { submitted: boolean };

let bindings: ReturnType<typeof createJourneyBindings<Ctx, StepId>>;

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
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Next</button>`
});

const Done = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.completeJourney();
    return { onClick };
  },
  template: `<button @click="onClick">Submit</button>`
});

const subscribeJourney: JourneyVueDefinition<Ctx, StepId> = {
  initial: "start",
  context: { submitted: false },
  steps: {
    start: { component: Start },
    review: { component: Review },
    done: { component: Done }
  },
  transitions: [
    { from: "start", event: "goToNextStep", to: "review" },
    {
      from: "review",
      event: "goToNextStep",
      to: "done",
      effect: ({ context }) => ({ ...context, submitted: true })
    },
    { from: "done", event: "completeJourney" }
  ]
};

bindings = createJourneyBindings(subscribeJourney);

const SubscriptionsPanel = defineComponent({
  setup() {
    const snapshot = bindings.useJourneySnapshot();
    const machine = bindings.useJourneyMachine();
    const eventTypes = ref<string[]>([]);

    const unsubscribeEvents = machine.subscribeEvent((event) => {
      eventTypes.value = [...eventTypes.value, event.type];
    });

    onUnmounted(() => {
      unsubscribeEvents();
    });

    return { snapshot, eventTypes };
  },
  template:
    `<section>` +
    `<div>Current step from useJourneySnapshot (machine.subscribe): {{ snapshot.currentStepId }}</div>` +
    `<div>Lifecycle events from machine.subscribeEvent: {{ eventTypes.join(", ") || "none yet" }}</div>` +
    `</section>`
});

export const SubscribeVsSubscribeEventExample = defineComponent({
  components: {
    Provider: bindings.Provider,
    StepRenderer: bindings.StepRenderer,
    SubscriptionsPanel
  },
  template: `<Provider><SubscriptionsPanel /><StepRenderer /></Provider>`
});
