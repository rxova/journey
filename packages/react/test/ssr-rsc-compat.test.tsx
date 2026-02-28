import { describe, expect, it } from "vitest";

import React from "react";
import { renderToString } from "react-dom/server";

import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "start" | "review";
type Event = "goToNextStep" | "back" | "terminateJourney" | "completeJourney";
type Ctx = { count: number };

const journey: JourneyReactDefinition<Ctx, StepId, Event> = {
  initial: "start",
  context: { count: 0 },
  steps: {
    start: { component: () => <div>start-ssr</div> },
    review: { component: () => <div>review-ssr</div> }
  },
  transitions: [{ from: "start", event: "goToNextStep", to: "review" }]
};

const bindings = createJourneyBindings(journey);

describe("SSR/RSC compatibility", () => {
  it("renders Provider + StepRenderer on the server", () => {
    const html = renderToString(
      <bindings.Provider>
        <bindings.StepRenderer />
      </bindings.Provider>
    );

    expect(html).toContain("start-ssr");
  });

  it("does not crash when persistence is provided during server render", () => {
    const html = renderToString(
      <bindings.Provider persistence={{ key: "server-journey" }}>
        <bindings.StepRenderer />
      </bindings.Provider>
    );

    expect(html).toContain("start-ssr");
  });
});
