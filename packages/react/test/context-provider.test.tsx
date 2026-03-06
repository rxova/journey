import { describe, expect, it, vi } from "vitest";

import React from "react";
import { render, screen } from "@testing-library/react";

import * as core from "@rxova/journey-core";
import type { JourneyMachine } from "@rxova/journey-core";
import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "one" | "two";
type Context = { count: number };
type Event = "goToNextStep" | "back" | "terminateJourney" | "completeJourney";

const StepOne = () => <div>one</div>;
const StepTwo = () => <div>two</div>;

const journey: JourneyReactDefinition<Context, StepId, Event> = {
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
  it("provides machine and journey values via hooks", () => {
    const machine = core.createJourneyMachine(journey);

    const ReadStore = () => {
      const resolvedMachine = bindings.useJourneyMachine();
      const snapshot = bindings.useJourneySnapshot();
      const sameMachine = resolvedMachine === machine ? "same" : "diff";
      return (
        <div data-testid="store">
          {sameMachine}:{snapshot.currentStepId}
        </div>
      );
    };

    render(
      <bindings.Provider machine={machine}>
        <ReadStore />
      </bindings.Provider>
    );

    expect(screen.getByTestId("store").textContent).toBe("same:one");
  });

  it("disposes internally owned machine on unmount", () => {
    const snapshot = core.createJourneyMachine(journey).getSnapshot();
    const dispose = vi.fn();

    const machine: JourneyMachine<Context, StepId, Event> = {
      getSnapshot: () => snapshot,
      send: async () => ({ transitioned: false, snapshot }),
      goToNextStep: async () => ({ transitioned: false, snapshot }),
      terminateJourney: async () => ({ transitioned: false, snapshot }),
      completeJourney: async () => ({ transitioned: false, snapshot }),
      goToPreviousStep: async () => ({ transitioned: false, snapshot }),
      goToLastVisitedStep: async () => ({ transitioned: false, snapshot }),
      updateContext: () => snapshot,
      updateStepMetadata: () => snapshot,
      clearStepError: () => snapshot,
      resetMachine: () => snapshot,
      dispose,
      subscribe: () => () => undefined,
      subscribeEvent: () => () => undefined
    };

    const createMachineSpy = vi
      .spyOn(core, "createJourneyMachine")
      .mockReturnValue(machine as never);
    const localBindings = createJourneyBindings(journey);

    const { unmount } = render(
      <localBindings.Provider>
        <div>child</div>
      </localBindings.Provider>
    );

    expect(createMachineSpy).toHaveBeenCalledTimes(1);
    unmount();
    expect(dispose).toHaveBeenCalledTimes(1);

    createMachineSpy.mockRestore();
  });
});
