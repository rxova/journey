import { describe, expect, it } from "vitest";

import React from "react";
import { act } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "start" | "details" | "review";
type Event = "goToNextStep" | "back" | "terminateJourney" | "completeJourney";
type Context = { count: number };
type Meta = { title: string };

const createJourney = (): JourneyReactDefinition<
  Context,
  StepId,
  Event,
  Record<never, never>,
  Meta
> => ({
  initial: "start",
  context: { count: 0 },
  steps: {
    start: { component: () => <div>start-step</div>, meta: { title: "Start" } },
    details: { component: () => <div>details-step</div>, meta: { title: "Details" } },
    review: { component: () => <div>review-step</div>, meta: { title: "Review" } }
  },
  transitions: [
    { from: "start", event: "goToNextStep", to: "details" },
    { from: "details", event: "goToNextStep", to: "review" }
  ]
});

describe("react integration", () => {
  it("renders current step and follows timeline navigation behavior", async () => {
    const journey = createJourney();
    const bindings = createJourneyBindings(journey);

    const Controls = () => {
      const snapshot = bindings.useJourneySnapshot();
      const api = bindings.useJourneyApi();
      return (
        <div>
          <div data-testid="current">{snapshot.currentStepId}</div>
          <button data-testid="goToNextStep" onClick={() => void api.goToNextStep()}>
            next
          </button>
          <button data-testid="back" onClick={() => void api.goToPreviousStep()}>
            back
          </button>
          <button data-testid="prevTwo" onClick={() => void api.goToPreviousStep(2)}>
            prevTwo
          </button>
          <button data-testid="last" onClick={() => void api.goToLastVisitedStep()}>
            last
          </button>
        </div>
      );
    };

    render(
      <bindings.Provider>
        <bindings.StepRenderer />
        <Controls />
      </bindings.Provider>
    );

    expect(screen.getByText("start-step")).toBeTruthy();

    fireEvent.click(screen.getByTestId("goToNextStep"));
    await screen.findByText("details-step");
    fireEvent.click(screen.getByTestId("goToNextStep"));
    await screen.findByText("review-step");

    fireEvent.click(screen.getByTestId("back"));
    await screen.findByText("details-step");

    fireEvent.click(screen.getByTestId("prevTwo"));
    await screen.findByText("start-step");

    fireEvent.click(screen.getByTestId("last"));
    await screen.findByText("review-step");

    expect(screen.getByTestId("current").textContent).toBe("review");
  });

  it("supports metadata updates through updateStepMetadata alias", async () => {
    const journey = createJourney();
    const bindings = createJourneyBindings(journey);

    const ReadMeta = () => {
      const snapshot = bindings.useJourneySnapshot();
      const api = bindings.useJourneyApi();
      return (
        <div>
          <div data-testid="meta">{snapshot.stepMeta.details.title}</div>
          <button
            data-testid="update"
            onClick={() =>
              api.updateStepMetadata("details", (meta) => ({
                ...meta,
                title: "Details updated"
              }))
            }
          >
            update
          </button>
        </div>
      );
    };

    render(
      <bindings.Provider>
        <ReadMeta />
      </bindings.Provider>
    );

    expect(screen.getByTestId("meta").textContent).toBe("Details");

    await act(async () => {
      fireEvent.click(screen.getByTestId("update"));
    });

    expect(screen.getByTestId("meta").textContent).toBe("Details updated");
  });
});
