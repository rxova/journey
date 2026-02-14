import { describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";

import React from "react";
import { render } from "@testing-library/react";
import { act } from "react";

import { HISTORY_TARGET, type JourneySnapshot } from "@rxova/journey-core";
import { JourneyProvider, useJourney, type JourneyReactDefinition } from "@rxova/journey-react";
import type { JourneyApi } from "@rxova/journey-react";

type StepId = "start" | "details" | "review";
type Event = "next" | "back";
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
    { from: "start", event: "next", to: "details" },
    { from: "details", event: "next", to: "review" },
    { from: "review", event: "next", to: "start" },
    { from: "*", event: "back", to: HISTORY_TARGET }
  ]
};

let latestApi: JourneyApi<Ctx, StepId, Event> | null = null;
let latestSnapshot: JourneySnapshot<Ctx, StepId> | null = null;

const Harness = () => {
  const { snapshot, api } = useJourney<Ctx, StepId, Event>();

  React.useLayoutEffect(() => {
    latestApi = api;
    latestSnapshot = snapshot;
  }, [snapshot, api]);

  return null;
};

describe("react performance budget", () => {
  it("runs hook-driven transitions within budget", async () => {
    latestApi = null;
    latestSnapshot = null;

    const { unmount } = render(
      <JourneyProvider journey={journey}>
        <Harness />
      </JourneyProvider>
    );

    expect(latestApi).not.toBeNull();
    expect(latestSnapshot).not.toBeNull();

    const iterations = 400;
    const budgetMs = 1500;

    await act(async () => {
      for (let i = 0; i < 50; i += 1) {
        await latestApi!.next();
      }
    });

    const start = performance.now();
    await act(async () => {
      for (let i = 0; i < iterations; i += 1) {
        await latestApi!.next();
      }
    });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(budgetMs);

    unmount();
  });
});
