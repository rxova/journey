import { defineComponent } from "vue";

import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "invitees" | "preferences" | "budget" | "confirmPlan";
type Event = "goToNextStep" | "back" | "terminateJourney" | "completeJourney";

type GroupTripContext = {
  needsBudgetReview: boolean;
};

const Invitees = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Invite travelers</button>`
});

const Preferences = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Save preferences</button>`
});

const Budget = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Set budget</button>`
});

const ConfirmPlan = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.completeJourney();
    return { onClick };
  },
  template: `<button @click="onClick">Confirm plan</button>`
});

export const groupTripJourney: JourneyVueDefinition<GroupTripContext, StepId, Event> = {
  initial: "invitees",
  context: {
    needsBudgetReview: true
  },
  steps: {
    invitees: { component: Invitees },
    preferences: { component: Preferences },
    budget: { component: Budget },
    confirmPlan: { component: ConfirmPlan }
  },
  transitions: [
    { from: "invitees", event: "goToNextStep", to: "preferences" },
    {
      from: "preferences",
      event: "goToNextStep",
      to: "budget",
      when: ({ context }) => context.needsBudgetReview
    },
    {
      from: "preferences",
      event: "goToNextStep",
      to: "confirmPlan",
      when: ({ context }) => !context.needsBudgetReview
    },
    { from: "budget", event: "goToNextStep", to: "confirmPlan" },
    { from: "confirmPlan", event: "completeJourney" },
    { from: "*", event: "terminateJourney" }
  ]
};

const bindings = createJourneyBindings(groupTripJourney);

export const GroupTripExample = defineComponent({
  components: { Provider: bindings.Provider, StepRenderer: bindings.StepRenderer },
  template: `<Provider><StepRenderer /></Provider>`
});
