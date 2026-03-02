import { describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";

import { defineComponent, h, nextTick } from "vue";
import { mount } from "@vue/test-utils";

import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "start" | "details" | "review";
type Event = "goToNextStep" | "back";
type Ctx = { count: number };

const Step = defineComponent(() => () => h("div"));

const journey: JourneyVueDefinition<Ctx, StepId, Event> = {
  initial: "start",
  context: { count: 0 },
  steps: {
    start: { component: Step },
    details: { component: Step },
    review: { component: Step }
  },
  transitions: [
    { from: "start", event: "goToNextStep", to: "details" },
    { from: "details", event: "goToNextStep", to: "review" },
    { from: "review", event: "goToNextStep", to: "start" }
  ]
};

const bindings = createJourneyBindings(journey);

type MinimalApi = { goToNextStep: () => Promise<void> };
let latestApi: MinimalApi = {
  goToNextStep: async () => undefined
};

const Harness = defineComponent(() => {
  latestApi = bindings.useJourneyApi() as unknown as MinimalApi;
  return () => null;
});

describe("vue performance budget", () => {
  it("runs bindings-driven transitions within budget", async () => {
    latestApi = {
      goToNextStep: async () => undefined
    };

    const wrapper = mount(bindings.Provider, {
      slots: {
        default: () => h(Harness)
      }
    });

    const api = latestApi;

    const iterations = 400;
    const budgetMs = 1500;

    for (let i = 0; i < 50; i += 1) {
      await api.goToNextStep();
    }
    await nextTick();

    const start = performance.now();
    for (let i = 0; i < iterations; i += 1) {
      await api.goToNextStep();
    }
    await nextTick();
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(budgetMs);

    wrapper.unmount();
  });
});
