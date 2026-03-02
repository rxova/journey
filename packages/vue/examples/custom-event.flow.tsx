import { defineComponent } from "vue";

import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "idle" | "failed" | "done";
type CustomEvent = "retry";
type Ctx = { tries: number };

const Idle = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.send({ type: "retry" });
    return { onClick };
  },
  template: `<button @click="onClick">Retry</button>`
});

const Failed = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.send({ type: "retry" });
    return { onClick };
  },
  template: `<button @click="onClick">Retry</button>`
});

const Done = defineComponent({
  template: `<div>Done</div>`
});

export const customEventJourney: JourneyVueDefinition<Ctx, StepId, CustomEvent> = {
  initial: "idle",
  context: { tries: 0 },
  steps: {
    idle: { component: Idle },
    failed: { component: Failed },
    done: { component: Done }
  },
  transitions: [
    {
      from: "idle",
      event: "retry",
      to: "failed",
      effect: ({ context }) => ({ ...context, tries: context.tries + 1 })
    },
    {
      from: "failed",
      event: "retry",
      to: "done",
      when: ({ context }) => context.tries > 0
    }
  ]
};

const bindings = createJourneyBindings(customEventJourney);

export const CustomEventExample = defineComponent({
  components: { Provider: bindings.Provider, StepRenderer: bindings.StepRenderer },
  template: `<Provider><StepRenderer /></Provider>`
});
