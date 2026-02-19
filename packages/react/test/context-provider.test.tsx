import { describe, expect, it } from "vitest";

import React from "react";
import { render, screen } from "@testing-library/react";

import { createJourneyMachine } from "@rxova/journey-core";
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
    const machine = createJourneyMachine(journey);

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
});
