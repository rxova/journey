import { describe, expect, it } from "vitest";

import React from "react";
import { renderToString } from "react-dom/server";

import { createJourney, type JourneyViews } from "@rxova/journey-react";
import type { JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "review";
type Ctx = { count: number };

const journeyDefinition: JourneyDefinition<Ctx, StepId> = {
  initial: "start",
  context: { count: 0 },
  steps: {
    start: { meta: { label: "Start" } },
    review: { meta: { label: "Review" } }
  },
  transitions: {
    start: { goToNextStep: [{ to: "review" }] }
  }
};

const journey = createJourney(journeyDefinition);
const views: JourneyViews<StepId> = {
  start: () => <div>start-ssr</div>,
  review: () => <div>review-ssr</div>
};

describe("SSR/RSC compatibility", () => {
  it("renders provider-free hooks on the server", () => {
    const CurrentStep = () => {
      const snapshot = journey.useJourneySnapshot();
      return <div>{snapshot.currentStepId}</div>;
    };

    const html = renderToString(<CurrentStep />);

    expect(html).toContain("start");
  });

  it("renders JourneyProvider and StepRenderer on the server", () => {
    const html = renderToString(
      <journey.JourneyProvider views={views}>
        <journey.StepRenderer />
      </journey.JourneyProvider>
    );

    expect(html).toContain("start-ssr");
  });

  it("does not auto-start the machine during server rendering", () => {
    const ssrJourney = createJourney(journeyDefinition);
    const html = renderToString(
      <ssrJourney.JourneyProvider views={views}>
        <ssrJourney.StepRenderer />
      </ssrJourney.JourneyProvider>
    );

    expect(html).toContain("start-ssr");
    expect(ssrJourney.machine.getSnapshot().status).toBe("idled");
  });
});
