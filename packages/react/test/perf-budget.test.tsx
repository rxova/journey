import { describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";

import React from "react";
import { act } from "react";
import { render } from "@testing-library/react";

import { createJourney, type JourneyApi } from "@rxova/journey-react";
import type { JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "details" | "review";
type EventMap = { type: "back"; payload?: unknown };
type Ctx = { count: number };

const journeyDefinition: JourneyDefinition<Ctx, StepId, EventMap> = {
  initial: "start",
  context: { count: 0 },
  steps: {
    start: { meta: { label: "Start" } },
    details: { meta: { label: "Details" } },
    review: { meta: { label: "Review" } }
  },
  transitions: {
    start: { goToNextStep: [{ to: "details" }] },
    details: { goToNextStep: [{ to: "review" }] },
    review: { goToNextStep: [{ to: "start" }] }
  }
};

const journey = createJourney(journeyDefinition);

let latestApi: JourneyApi<Ctx, StepId, EventMap> | null = null;

const Harness = () => {
  const api = journey.useJourneyApi();

  React.useLayoutEffect(() => {
    latestApi = api;
  }, [api]);

  return null;
};

describe("react performance budget", () => {
  it("runs bindings-driven transitions within budget", async () => {
    latestApi = null;

    const { unmount } = render(<Harness />);

    expect(latestApi).not.toBeNull();

    const iterations = 400;
    const budgetMs = 1500;

    await act(async () => {
      for (let i = 0; i < 50; i += 1) {
        await latestApi?.goToNextStep();
      }
    });

    const start = performance.now();
    await act(async () => {
      for (let i = 0; i < iterations; i += 1) {
        await latestApi?.goToNextStep();
      }
    });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(budgetMs);

    unmount();
    journey.dispose();
  });
});
