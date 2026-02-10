import { describe, expect, it } from "vitest";

import React from "react";
import { render, screen } from "@testing-library/react";
import { act } from "react";

import { JOURNEY_STATUS, HISTORY_TARGET, JOURNEY_TERMINAL } from "@/src/core";
import { JourneyProvider, JourneyStepRenderer, useJourney } from "@/src/react";
import type { JourneyReactDefinition } from "@/src/react";

type StepId = "start" | "details" | "review" | "confirmExit";
type Event = "next" | "back" | "close" | "submit";
type Ctx = { dirty: boolean; log: string[] };

const Start = () => <div data-testid="step">start</div>;
const Details = () => <div data-testid="step">details</div>;
const Review = () => <div data-testid="step">review</div>;
const ConfirmClose = () => <div data-testid="step">confirm-close</div>;

const journey: JourneyReactDefinition<Ctx, StepId, Event> = {
  initial: "start",
  context: { dirty: false, log: [] },
  steps: {
    start: { component: Start },
    details: { component: Details },
    review: { component: Review },
    confirmExit: { component: ConfirmClose }
  },
  transitions: [
    { from: "start", event: "next", to: "details" },
    { from: "details", event: "next", to: "review" },
    { from: "*", event: "back", to: HISTORY_TARGET },
    {
      from: "*",
      event: "close",
      to: "confirmExit",
      when: ({ context }: { context: Ctx }) => context.dirty
    },
    {
      from: "*",
      event: "close",
      to: JOURNEY_TERMINAL.CLOSE,
      when: ({ context }: { context: Ctx }) => !context.dirty
    },
    { from: "review", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};

const Controls = () => {
  const { snapshot, api } = useJourney<Ctx, StepId, Event>();

  return (
    <div>
      <button onClick={() => api.next()}>next</button>
      <button onClick={() => api.back()}>back</button>
      <button onClick={() => api.close()}>close</button>
      <button onClick={() => api.submit()}>submit</button>
      <button onClick={() => api.updateContext((ctx) => ({ ...ctx, dirty: true }))}>dirty</button>
      <div data-testid="current">{snapshot.current}</div>
      <div data-testid="terminal">{snapshot.status}</div>
    </div>
  );
};

const TestApp = () => (
  <JourneyProvider journey={journey}>
    <JourneyStepRenderer<Ctx, StepId, Event> />
    <Controls />
  </JourneyProvider>
);

describe("react integration", () => {
  it("renders current step and moves forward", async () => {
    render(<TestApp />);

    expect(screen.getByTestId("step").textContent).toBe("start");

    await act(async () => {
      screen.getByText("next").click();
    });

    expect(screen.getByTestId("step").textContent).toBe("details");
    expect(screen.getByTestId("current").textContent).toBe("details");
  });

  it("supports back via history target", async () => {
    render(<TestApp />);

    await act(async () => {
      screen.getByText("next").click();
    });
    await act(async () => {
      screen.getByText("next").click();
    });
    await act(async () => {
      screen.getByText("back").click();
    });

    expect(screen.getByTestId("current").textContent).toBe("details");
  });

  it("routes close declaratively", async () => {
    render(<TestApp />);

    await act(async () => {
      screen.getByText("dirty").click();
      screen.getByText("close").click();
    });

    expect(screen.getByTestId("step").textContent).toBe("confirm-close");
  });

  it("supports terminal transitions", async () => {
    render(<TestApp />);

    await act(async () => {
      screen.getByText("next").click();
    });
    await act(async () => {
      screen.getByText("next").click();
    });
    await act(async () => {
      screen.getByText("submit").click();
    });

    expect(screen.getByTestId("terminal").textContent).toBe(JOURNEY_STATUS.COMPLETE);
  });

  it("recreates internal machine when journey prop changes", async () => {
    const { rerender } = render(
      <JourneyProvider journey={journey}>
        <JourneyStepRenderer<Ctx, StepId, Event> />
        <Controls />
      </JourneyProvider>
    );

    await act(async () => {
      screen.getByText("next").click();
    });
    expect(screen.getByTestId("current").textContent).toBe("details");

    const nextJourney: JourneyReactDefinition<Ctx, StepId, Event> = {
      ...journey,
      initial: "review"
    };

    rerender(
      <JourneyProvider journey={nextJourney}>
        <JourneyStepRenderer<Ctx, StepId, Event> />
        <Controls />
      </JourneyProvider>
    );

    expect(screen.getByTestId("current").textContent).toBe("review");
  });
});
