import { describe, expect, it } from "vitest";

import { defineComponent, h, nextTick } from "vue";
import { mount } from "@vue/test-utils";

import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "one" | "two";
type Event = "goToNextStep" | "back" | "terminateJourney" | "completeJourney";
type Context = { count: number };
type MinimalApi = { goToNextStep: () => Promise<void> };

const journeyA: JourneyVueDefinition<Context, StepId, Event> = {
  initial: "one",
  context: { count: 0 },
  steps: {
    one: { component: defineComponent(() => () => h("div", "one-a")) },
    two: { component: defineComponent(() => () => h("div", "two-a")) }
  },
  transitions: [{ from: "one", event: "goToNextStep", to: "two" }]
};

const journeyB: JourneyVueDefinition<Context, StepId, Event> = {
  initial: "one",
  context: { count: 10 },
  steps: {
    one: { component: defineComponent(() => () => h("div", "one-b")) },
    two: { component: defineComponent(() => () => h("div", "two-b")) }
  },
  transitions: [{ from: "one", event: "goToNextStep", to: "two" }]
};

const bindings = createJourneyBindings(journeyA);

const createCapture = (onApi: (api: ReturnType<typeof bindings.useJourneyApi>) => void) =>
  defineComponent(() => {
    const snapshot = bindings.useJourneySnapshot();
    const api = bindings.useJourneyApi();
    onApi(api);

    return () => h("div", { "data-testid": "current" }, snapshot.value.currentStepId);
  });

describe("bindings composables edge cases", () => {
  it("throws outside Provider", () => {
    const UseJourneyApi = defineComponent(() => {
      bindings.useJourneyApi();
      return () => null;
    });
    const UseJourneySnapshot = defineComponent(() => {
      bindings.useJourneySnapshot();
      return () => null;
    });
    const UseJourneyMachine = defineComponent(() => {
      bindings.useJourneyMachine();
      return () => null;
    });

    expect(() => mount(UseJourneyApi)).toThrow(/bindings\.Provider/);
    expect(() => mount(UseJourneySnapshot)).toThrow(/bindings\.Provider/);
    expect(() => mount(UseJourneyMachine)).toThrow(/bindings\.Provider/);
    expect(() => mount(bindings.StepRenderer)).toThrow(/bindings\.Provider/);
  });

  it("does not reset internal machine on journey change unless resetOnJourneyChange=true", async () => {
    let api: MinimalApi = {
      goToNextStep: async () => undefined
    };
    const Capture = createCapture((nextApi) => {
      api = nextApi;
    });

    const wrapper = mount(bindings.Provider, {
      props: { journey: journeyA },
      slots: {
        default: () => [h(Capture), h(bindings.StepRenderer)]
      }
    });
    const resolvedApi = () => {
      if (!api) {
        throw new Error("Missing journey api.");
      }
      return api;
    };

    expect(wrapper.text()).toContain("one-a");

    await resolvedApi().goToNextStep();
    await nextTick();
    expect(wrapper.text()).toContain("two-a");

    await wrapper.setProps({ journey: journeyB });
    await nextTick();
    expect(wrapper.text()).toContain("two-a");
    expect(wrapper.get('[data-testid="current"]').text()).toBe("two");

    await wrapper.setProps({ journey: journeyB, resetOnJourneyChange: true });
    await nextTick();
    expect(wrapper.text()).toContain("one-b");
    expect(wrapper.get('[data-testid="current"]').text()).toBe("one");
  });

  it("StepRenderer uses fallback when current step component is missing", async () => {
    const minimalJourney: JourneyVueDefinition<Context, StepId, Event> = {
      initial: "one",
      context: { count: 0 },
      steps: {
        one: { component: defineComponent(() => () => h("div", "one-min")) },
        two: { component: undefined as never }
      },
      transitions: [{ from: "one", event: "goToNextStep", to: "two" }]
    };

    const localBindings = createJourneyBindings(minimalJourney);

    let api: MinimalApi = {
      goToNextStep: async () => undefined
    };

    const CaptureApi = defineComponent(() => {
      api = localBindings.useJourneyApi() as unknown as MinimalApi;
      return () => null;
    });

    const wrapper = mount(localBindings.Provider, {
      slots: {
        default: () => [
          h(CaptureApi),
          h(localBindings.StepRenderer, { fallback: h("div", "fallback") })
        ]
      }
    });

    expect(wrapper.text()).toContain("one-min");
    await api.goToNextStep();
    await nextTick();
    expect(wrapper.text()).toContain("fallback");
  });
});
