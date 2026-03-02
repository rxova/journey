import { describe, expect, it } from "vitest";

import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";

import { createJourneyMachine } from "@rxova/journey-core";
import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "one" | "two";
type Context = { count: number };
type Event = "goToNextStep" | "back" | "terminateJourney" | "completeJourney";

const StepOne = defineComponent(() => () => h("div", "one"));
const StepTwo = defineComponent(() => () => h("div", "two"));

const journey: JourneyVueDefinition<Context, StepId, Event> = {
  initial: "one",
  context: { count: 0 },
  steps: {
    one: { component: StepOne },
    two: { component: StepTwo }
  },
  transitions: [{ from: "one", event: "goToNextStep", to: "two" }]
};

const bindings = createJourneyBindings(journey);

describe("bindings.Provider", () => {
  it("provides machine and journey values via composables", () => {
    const machine = createJourneyMachine(journey);

    const ReadStore = defineComponent(() => {
      const resolvedMachine = bindings.useJourneyMachine();
      const snapshot = bindings.useJourneySnapshot();
      const sameMachine = resolvedMachine === machine ? "same" : "diff";

      return () =>
        h("div", { "data-testid": "store" }, `${sameMachine}:${snapshot.value.currentStepId}`);
    });

    const wrapper = mount(bindings.Provider, {
      props: { machine },
      slots: {
        default: () => h(ReadStore)
      }
    });

    expect(wrapper.get('[data-testid="store"]').text()).toBe("same:one");
  });
});
