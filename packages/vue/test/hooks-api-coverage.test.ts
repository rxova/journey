import { describe, expect, it, vi } from "vitest";

import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";

import {
  JOURNEY_STATUS,
  type JourneyMachine,
  type JourneySendResult,
  type JourneySnapshot
} from "@rxova/journey-core";
import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "one" | "two";
type Context = { count: number };
type Event =
  | "goToNextStep"
  | "goToPreviousStep"
  | "terminateJourney"
  | "completeJourney"
  | "custom";
type Meta = { title: string };

const journey: JourneyVueDefinition<Context, StepId, Event, Record<never, never>, Meta> = {
  initial: "one",
  context: { count: 0 },
  steps: {
    one: { component: defineComponent(() => () => h("div", "one")), meta: { title: "One" } },
    two: { component: defineComponent(() => () => h("div", "two")), meta: { title: "Two" } }
  },
  transitions: [{ from: "one", event: "goToNextStep", to: "two" }]
};

const bindings = createJourneyBindings(journey);

const snapshot: JourneySnapshot<Context, StepId, Meta> = {
  currentStepId: "one",
  history: {
    timeline: ["one"],
    index: 0
  },
  context: { count: 0 },
  visited: { one: true, two: false },
  stepMeta: {
    one: { title: "One" },
    two: { title: "Two" }
  },
  status: JOURNEY_STATUS.RUNNING,
  async: {
    isLoading: false,
    byStep: {
      one: { phase: "idle", eventType: null, transitionId: null, error: null },
      two: { phase: "idle", eventType: null, transitionId: null, error: null }
    }
  }
};

const sendResult: JourneySendResult<Context, StepId, Meta> = {
  transitioned: true,
  snapshot
};

describe("useJourneyApi", () => {
  it("delegates all api calls to the machine", async () => {
    const send = vi.fn(async () => sendResult);
    const goToNextStep = vi.fn(async () => sendResult);
    const terminateJourney = vi.fn(async () => sendResult);
    const completeJourney = vi.fn(async () => sendResult);
    const goToPreviousStep = vi.fn(async () => sendResult);
    const goToLastVisitedStep = vi.fn(async () => sendResult);
    const updateContext = vi.fn(() => snapshot);
    const updateStepMetadata = vi.fn(() => snapshot);
    const clearStepError = vi.fn(() => snapshot);
    const resetMachine = vi.fn(() => snapshot);

    const machine: JourneyMachine<Context, StepId, Event, Record<never, never>, Meta> = {
      getSnapshot: () => snapshot,
      send,
      goToNextStep,
      terminateJourney,
      completeJourney,
      goToPreviousStep,
      goToLastVisitedStep,
      updateContext,
      updateStepMetadata,
      clearStepError,
      resetMachine,
      subscribe: () => () => undefined,
      subscribeEvent: () => () => undefined
    };

    const Controls = defineComponent(() => {
      const api = bindings.useJourneyApi();

      return () =>
        h("div", [
          h("button", { "data-testid": "send", onClick: () => void api.send({ type: "custom" }) }),
          h("button", {
            "data-testid": "goTo-send",
            onClick: () => void api.send({ type: "goToStepById", stepId: "two" })
          }),
          h("button", {
            "data-testid": "goTo-send-payload",
            onClick: () =>
              void api.send({ type: "goToStepById", stepId: "two", payload: { reason: "manual" } })
          }),
          h("button", { "data-testid": "goToNextStep", onClick: () => void api.goToNextStep() }),
          h("button", {
            "data-testid": "terminateJourney",
            onClick: () => void api.terminateJourney()
          }),
          h("button", {
            "data-testid": "terminateJourney-payload",
            onClick: () => void api.terminateJourney({ reason: "manual" })
          }),
          h("button", {
            "data-testid": "completeJourney",
            onClick: () => void api.completeJourney()
          }),
          h("button", {
            "data-testid": "completeJourney-payload",
            onClick: () => void api.completeJourney({ reason: "done" })
          }),
          h("button", {
            "data-testid": "goToPreviousStep",
            onClick: () => void api.goToPreviousStep()
          }),
          h("button", {
            "data-testid": "goToPreviousStep-steps",
            onClick: () => void api.goToPreviousStep(2)
          }),
          h("button", {
            "data-testid": "goToLastVisitedStep",
            onClick: () => void api.goToLastVisitedStep()
          }),
          h("button", {
            "data-testid": "updateContext",
            onClick: () =>
              api.updateContext((context) => ({ ...context, count: context.count + 1 }))
          }),
          h("button", {
            "data-testid": "updateStepMetadata",
            onClick: () =>
              api.updateStepMetadata("one", (meta) => ({ ...meta, title: `${meta.title}!` }))
          }),
          h("button", {
            "data-testid": "updateComponentMetadata",
            onClick: () =>
              api.updateComponentMetadata("one", (meta) => ({ ...meta, title: `${meta.title}?` }))
          }),
          h("button", {
            "data-testid": "clearStepError",
            onClick: () => api.clearStepError("one")
          }),
          h("button", {
            "data-testid": "clearStepError-empty",
            onClick: () => api.clearStepError()
          }),
          h("button", { "data-testid": "resetJourney", onClick: () => api.resetJourney() })
        ]);
    });

    const wrapper = mount(bindings.Provider, {
      props: { machine },
      slots: { default: () => h(Controls) }
    });

    await wrapper.get('[data-testid="send"]').trigger("click");
    await wrapper.get('[data-testid="goTo-send"]').trigger("click");
    await wrapper.get('[data-testid="goTo-send-payload"]').trigger("click");
    await wrapper.get('[data-testid="goToNextStep"]').trigger("click");
    await wrapper.get('[data-testid="terminateJourney"]').trigger("click");
    await wrapper.get('[data-testid="terminateJourney-payload"]').trigger("click");
    await wrapper.get('[data-testid="completeJourney"]').trigger("click");
    await wrapper.get('[data-testid="completeJourney-payload"]').trigger("click");
    await wrapper.get('[data-testid="goToPreviousStep"]').trigger("click");
    await wrapper.get('[data-testid="goToPreviousStep-steps"]').trigger("click");
    await wrapper.get('[data-testid="goToLastVisitedStep"]').trigger("click");
    await wrapper.get('[data-testid="updateContext"]').trigger("click");
    await wrapper.get('[data-testid="updateStepMetadata"]').trigger("click");
    await wrapper.get('[data-testid="updateComponentMetadata"]').trigger("click");
    await wrapper.get('[data-testid="clearStepError"]').trigger("click");
    await wrapper.get('[data-testid="clearStepError-empty"]').trigger("click");
    await wrapper.get('[data-testid="resetJourney"]').trigger("click");

    expect(send).toHaveBeenNthCalledWith(1, { type: "custom" });
    expect(send).toHaveBeenNthCalledWith(2, { type: "goToStepById", stepId: "two" });
    expect(send).toHaveBeenNthCalledWith(3, {
      type: "goToStepById",
      stepId: "two",
      payload: { reason: "manual" }
    });
    expect(goToNextStep).toHaveBeenCalledTimes(1);
    expect(terminateJourney).toHaveBeenNthCalledWith(1, undefined);
    expect(terminateJourney).toHaveBeenNthCalledWith(2, { reason: "manual" });
    expect(completeJourney).toHaveBeenNthCalledWith(1, undefined);
    expect(completeJourney).toHaveBeenNthCalledWith(2, { reason: "done" });
    expect(goToPreviousStep).toHaveBeenNthCalledWith(1, undefined);
    expect(goToPreviousStep).toHaveBeenNthCalledWith(2, 2);
    expect(goToLastVisitedStep).toHaveBeenCalledTimes(1);
    expect(updateContext).toHaveBeenCalledTimes(1);
    expect(updateStepMetadata).toHaveBeenCalledTimes(2);
    expect(clearStepError).toHaveBeenNthCalledWith(1, "one");
    expect(clearStepError).toHaveBeenNthCalledWith(2, undefined);
    expect(resetMachine).toHaveBeenCalledTimes(1);
  });
});
