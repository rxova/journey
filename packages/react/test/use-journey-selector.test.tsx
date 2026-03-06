import { describe, expect, it, vi } from "vitest";

import React from "react";
import { act } from "react";
import { render, screen } from "@testing-library/react";

import { createJourneyMachine } from "@rxova/journey-core";
import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "start" | "details";
type Context = { count: number };

const journey: JourneyReactDefinition<Context, StepId> = {
  initial: "start",
  context: { count: 0 },
  steps: {
    start: { component: () => <div>start</div> },
    details: { component: () => <div>details</div> }
  },
  transitions: [{ from: "start", event: "goToNextStep", to: "details" }]
};

const bindings = createJourneyBindings(journey);

describe("useJourneySelector", () => {
  it("does not rerender when unrelated snapshot fields update", async () => {
    const machine = createJourneyMachine(journey);
    const reportRender = vi.fn();

    const ReadCurrentStep = () => {
      const currentStepId = bindings.useJourneySelector((snapshot) => snapshot.currentStepId);

      React.useLayoutEffect(() => {
        reportRender();
      });

      return <div data-testid="current-step">{currentStepId}</div>;
    };

    render(
      <bindings.Provider machine={machine}>
        <ReadCurrentStep />
      </bindings.Provider>
    );

    expect(screen.getByTestId("current-step").textContent).toBe("start");
    expect(reportRender).toHaveBeenCalledTimes(1);

    act(() => {
      machine.updateContext((context) => ({ ...context, count: context.count + 1 }));
    });
    expect(reportRender).toHaveBeenCalledTimes(1);

    await act(async () => {
      await machine.goToNextStep();
    });

    expect(screen.getByTestId("current-step").textContent).toBe("details");
    expect(reportRender).toHaveBeenCalledTimes(2);
  });

  it("supports custom equality for derived object selectors", async () => {
    const machine = createJourneyMachine(journey);
    const reportRender = vi.fn();

    const ReadSelectedObject = () => {
      const selected = bindings.useJourneySelector(
        (snapshot) => ({ step: snapshot.currentStepId }),
        (previous, next) => previous.step === next.step
      );

      React.useLayoutEffect(() => {
        reportRender();
      });

      return <div data-testid="current-step-object">{selected.step}</div>;
    };

    render(
      <bindings.Provider machine={machine}>
        <ReadSelectedObject />
      </bindings.Provider>
    );

    expect(screen.getByTestId("current-step-object").textContent).toBe("start");
    expect(reportRender).toHaveBeenCalledTimes(1);

    act(() => {
      machine.updateContext((context) => ({ ...context, count: context.count + 1 }));
    });
    expect(reportRender).toHaveBeenCalledTimes(1);

    await act(async () => {
      await machine.goToNextStep();
    });

    expect(screen.getByTestId("current-step-object").textContent).toBe("details");
    expect(reportRender).toHaveBeenCalledTimes(2);
  });
});
