import { defineComponent } from "vue";

import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "edit" | "confirmExit";
type Event = "requestClose";
type Ctx = { dirty: boolean };

const Edit = defineComponent({
  setup() {
    const snapshot = bindings.useJourneySnapshot();
    const api = bindings.useJourneyApi();
    const makeDirty = () => api.updateContext((ctx) => ({ ...ctx, dirty: true }));
    const close = () => {
      if (snapshot.value.context.dirty) {
        void api.send({ type: "requestClose" });
        return;
      }
      void api.terminateJourney();
    };
    return { makeDirty, close };
  },
  template: `<div><button @click="makeDirty">Make dirty</button><button @click="close">Close</button></div>`
});

const ConfirmExit = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.terminateJourney();
    return { onClick };
  },
  template: `<button @click="onClick">Confirm close</button>`
});

export const confirmExitJourney: JourneyVueDefinition<Ctx, StepId, Event> = {
  initial: "edit",
  context: { dirty: false },
  steps: {
    edit: { component: Edit },
    confirmExit: { component: ConfirmExit }
  },
  transitions: [
    {
      from: "*",
      event: "requestClose",
      to: "confirmExit",
      when: ({ context }) => context.dirty
    },
    { from: "*", event: "terminateJourney" }
  ]
};

const bindings = createJourneyBindings(confirmExitJourney);

export const ConfirmExitExample = defineComponent({
  components: { Provider: bindings.Provider, StepRenderer: bindings.StepRenderer },
  template: `<Provider><StepRenderer /></Provider>`
});
