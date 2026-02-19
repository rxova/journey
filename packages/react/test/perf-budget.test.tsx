import { describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";

import React from "react";
import { act } from "react";
import { render } from "@testing-library/react";

import {
  createJourneyBindings,
  type JourneyApi,
  type JourneyReactDefinition
} from "@rxova/journey-react";

type StepId = "start" | "details" | "review";
type Event = "goToNextStep" | "back";
type Ctx = { count: number };

const Step = () => <div />;

const journey: JourneyReactDefinition<Ctx, StepId, Event> = {
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

let latestApi: JourneyApi<Ctx, StepId, Event> | null = null;

const Harness = () => {
  const api = bindings.useJourneyApi();

  React.useLayoutEffect(() => {
    latestApi = api;
  }, [api]);

  return null;
};

describe("react performance budget", () => {
  it("runs bindings-driven transitions within budget", async () => {
    latestApi = null;

    const { unmount } = render(
      <bindings.Provider>
        <Harness />
      </bindings.Provider>
    );

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
  });
});
