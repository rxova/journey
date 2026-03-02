import { defineComponent } from "vue";

import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "validate" | "blocked" | "allowed";
type Ctx = { token: string };

const Validate = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Check token</button>`
});
const Blocked = defineComponent({
  template: `<div>Blocked</div>`
});
const Allowed = defineComponent({
  template: `<div>Allowed</div>`
});

const isTokenValid = async (token: string) => token.length > 3;

export const asyncGuardJourney: JourneyVueDefinition<Ctx, StepId> = {
  initial: "validate",
  context: { token: "abcd" },
  steps: {
    validate: { component: Validate },
    blocked: { component: Blocked },
    allowed: { component: Allowed }
  },
  transitions: [
    {
      from: "validate",
      event: "goToNextStep",
      to: "allowed",
      when: async ({ context }) => isTokenValid(context.token)
    },
    {
      from: "validate",
      event: "goToNextStep",
      to: "blocked",
      when: async ({ context }) => !(await isTokenValid(context.token))
    }
  ]
};

const bindings = createJourneyBindings(asyncGuardJourney);

export const AsyncGuardExample = defineComponent({
  components: { Provider: bindings.Provider, StepRenderer: bindings.StepRenderer },
  template: `<Provider><StepRenderer /></Provider>`
});
