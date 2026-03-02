import { describe, expect, it } from "vitest";

import { defineComponent, h, nextTick } from "vue";
import { mount } from "@vue/test-utils";

import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "start" | "details" | "review";
type Event = "goToNextStep" | "back" | "terminateJourney" | "completeJourney";
type Context = { count: number };
type Meta = { title: string };

const createJourney = (): JourneyVueDefinition<
  Context,
  StepId,
  Event,
  Record<never, never>,
  Meta
> => ({
  initial: "start",
  context: { count: 0 },
  steps: {
    start: {
      component: defineComponent(() => () => h("div", "start-step")),
      meta: { title: "Start" }
    },
    details: {
      component: defineComponent(() => () => h("div", "details-step")),
      meta: { title: "Details" }
    },
    review: {
      component: defineComponent(() => () => h("div", "review-step")),
      meta: { title: "Review" }
    }
  },
  transitions: [
    { from: "start", event: "goToNextStep", to: "details" },
    { from: "details", event: "goToNextStep", to: "review" }
  ]
});

describe("vue integration", () => {
  it("renders current step and follows timeline navigation behavior", async () => {
    const journey = createJourney();
    const bindings = createJourneyBindings(journey);

    let api: ReturnType<typeof bindings.useJourneyApi> | null = null;

    const Controls = defineComponent(() => {
      const snapshot = bindings.useJourneySnapshot();
      api = bindings.useJourneyApi();

      return () => h("div", [h("div", { "data-testid": "current" }, snapshot.value.currentStepId)]);
    });

    const wrapper = mount(bindings.Provider, {
      slots: {
        default: () => [h(bindings.StepRenderer), h(Controls)]
      }
    });
    const resolvedApi = () => {
      if (!api) {
        throw new Error("Missing journey api.");
      }
      return api;
    };

    expect(wrapper.text()).toContain("start-step");

    await resolvedApi().goToNextStep();
    await nextTick();
    expect(wrapper.text()).toContain("details-step");

    await resolvedApi().goToNextStep();
    await nextTick();
    expect(wrapper.text()).toContain("review-step");

    await resolvedApi().goToPreviousStep();
    await nextTick();
    expect(wrapper.text()).toContain("details-step");

    await resolvedApi().goToPreviousStep(2);
    await nextTick();
    expect(wrapper.text()).toContain("start-step");

    await resolvedApi().goToLastVisitedStep();
    await nextTick();
    expect(wrapper.text()).toContain("review-step");
    expect(wrapper.get('[data-testid="current"]').text()).toBe("review");
  });

  it("supports metadata updates through updateStepMetadata alias", async () => {
    const journey = createJourney();
    const bindings = createJourneyBindings(journey);

    let api: ReturnType<typeof bindings.useJourneyApi> | null = null;

    const ReadMeta = defineComponent(() => {
      const snapshot = bindings.useJourneySnapshot();
      api = bindings.useJourneyApi();

      return () => h("div", { "data-testid": "meta" }, snapshot.value.stepMeta.details.title);
    });

    const wrapper = mount(bindings.Provider, {
      slots: {
        default: () => h(ReadMeta)
      }
    });
    const resolvedApi = () => {
      if (!api) {
        throw new Error("Missing journey api.");
      }
      return api;
    };

    expect(wrapper.get('[data-testid="meta"]').text()).toBe("Details");

    resolvedApi().updateStepMetadata("details", (meta) => ({ ...meta, title: "Details updated" }));
    await nextTick();

    expect(wrapper.get('[data-testid="meta"]').text()).toBe("Details updated");
  });
});
