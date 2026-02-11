import { describe, expect, it } from "vitest";

import React from "react";
import { render, screen } from "@testing-library/react";

import { createJourneyMachine } from "@rxova/journey-core";
import { JourneyProvider, useJourneyStore } from "../src/context";
import type { JourneyReactDefinition } from "../src/types";

type StepId = "one" | "two";

type Context = { count: number };

type Event = "next" | "back" | "close" | "submit";

const journey: JourneyReactDefinition<Context, StepId, Event> = {
  initial: "one",
  context: { count: 0 },
  steps: {
    one: { component: () => null },
    two: { component: () => null }
  },
  transitions: [{ from: "one", event: "next", to: "two" }]
};

describe("JourneyProvider", () => {
  it("provides machine and journey values via context", () => {
    const machine = createJourneyMachine(journey);

    const ReadStore = () => {
      const store = useJourneyStore<Context, StepId, Event>("useJourneyStore");
      const sameMachine = store.machine === machine ? "same" : "diff";
      return (
        <div data-testid="store">
          {sameMachine}:{store.journey.initial}
        </div>
      );
    };

    render(
      <JourneyProvider journey={journey} machine={machine}>
        <ReadStore />
      </JourneyProvider>
    );

    expect(screen.getByTestId("store").textContent).toBe("same:one");
  });
});
