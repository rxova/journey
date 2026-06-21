import { describe, expect, it } from "vitest";

import { act, render, screen } from "@testing-library/react";

import {
  createGraphJourney,
  createHeadlessJourney,
  createLinearJourney,
  createJourney,
  type JourneyViews
} from "@rxova/journey-react";
import { createGraphJourneyBuilder } from "@rxova/journey-core";
import type { JourneyDefinition, JourneyEmpty } from "@rxova/journey-core";

type SimpleContext = { value: number };

// ─── createGraphJourney (named React wrapper) ────────────────────────────────

describe("createGraphJourney (React)", () => {
  it("builds a graph runtime and drives it through an event", async () => {
    type StepId = "start" | "done";
    type EventMap = { go: undefined };

    const { createStep, to, build } = createGraphJourneyBuilder<{
      context: SimpleContext;
      stepId: StepId;
      events: EventMap;
    }>();

    const runtime = createGraphJourney(
      build({
        initial: "start",
        context: { value: 0 },
        steps: [createStep("start", { on: { go: [to("done")] } }), createStep("done")]
      })
    );

    const views: JourneyViews<StepId> = {
      start: () => <div data-testid="graph-step">Start</div>,
      done: () => <div data-testid="graph-step">Done</div>
    };

    render(
      <runtime.JourneyProvider views={views}>
        <runtime.StepRenderer />
      </runtime.JourneyProvider>
    );

    expect(screen.getByTestId("graph-step").textContent).toBe("Start");

    await act(async () => {
      await runtime.machine.startJourney();
      await runtime.machine.send({ type: "go" });
    });

    expect(screen.getByTestId("graph-step").textContent).toBe("Done");
    expect(runtime.machine.getSnapshot().currentStepId).toBe("done");
    runtime.dispose();
  });
});

// ─── createHeadlessJourney (named React wrapper) ─────────────────────────────

describe("createHeadlessJourney (React)", () => {
  it("creates a headless runtime navigated via goToStepById", async () => {
    const runtime = createHeadlessJourney<SimpleContext, "start" | "end">({
      initial: "start",
      context: { value: 0 },
      steps: { start: {}, end: {} }
    });

    await act(async () => {
      await runtime.machine.startJourney();
    });

    expect(runtime.machine.getSnapshot().currentStepId).toBe("start");
    expect(runtime.machine.getComputed().mode).toBe("headless");

    let transitioned = false;
    await act(async () => {
      const result = await runtime.machine.goToStepById("end");
      transitioned = result.transitioned;
    });

    expect(transitioned).toBe(true);
    expect(runtime.machine.getSnapshot().currentStepId).toBe("end");
    runtime.dispose();
  });
});

// ─── createLinearJourney (named React wrapper) ───────────────────────────────

describe("createLinearJourney (React)", () => {
  it("creates a linear runtime that advances by order and exposes the machine", async () => {
    const runtime = createLinearJourney<SimpleContext, "a" | "b" | "c">({
      context: { value: 0 },
      steps: ["a", "b", "c"]
    });

    expect(runtime.machine.getComputed().mode).toBe("linear");

    await act(async () => {
      await runtime.machine.startJourney();
    });
    expect(runtime.machine.getSnapshot().currentStepId).toBe("a");

    await act(async () => {
      await runtime.machine.goToNextStep();
    });

    expect(runtime.machine.getSnapshot().currentStepId).toBe("b");
    runtime.dispose();
  });
});

// ─── createJourney routing (headless + linear-with-handlers) ─────────────────

describe("createJourney transition routing", () => {
  it("routes a definition without transitions to a headless machine", async () => {
    const journey = createJourney<JourneyDefinition<SimpleContext, "start" | "end">>({
      initial: "start",
      context: { value: 0 },
      steps: { start: {}, end: {} }
      // No `transitions` — caller-driven, headless mode.
    });

    await act(async () => {
      await journey.machine.startJourney();
    });

    expect(journey.machine.getComputed().mode).toBe("headless");

    let transitioned = false;
    await act(async () => {
      const result = await journey.machine.goToStepById("end");
      transitioned = result.transitioned;
    });

    expect(transitioned).toBe(true);
    expect(journey.machine.getSnapshot().currentStepId).toBe("end");
    journey.dispose();
  });

  it("forwards handlers when routing an ordered definition to a linear machine", async () => {
    type Handlers = { track: (label: string) => void };
    const tracked: string[] = [];

    const journey = createJourney<
      JourneyDefinition<SimpleContext, "a" | "b", JourneyEmpty, unknown, Handlers>
    >({
      context: { value: 0 },
      handlers: { track: (label) => tracked.push(label) },
      steps: {
        a: {},
        b: { onEnter: ({ handlers }) => handlers.track("b") }
      },
      transitions: ["a", "b"]
    });

    expect(journey.machine.getComputed().mode).toBe("linear");

    await act(async () => {
      await journey.machine.startJourney();
      await journey.machine.goToNextStep(); // a → b, fires b.onEnter with injected handlers
    });

    expect(tracked).toContain("b");
    journey.dispose();
  });
});
