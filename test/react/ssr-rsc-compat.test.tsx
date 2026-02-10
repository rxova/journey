// @vitest-environment node

import { describe, expect, it } from "vitest";

import React from "react";
import { renderToString } from "react-dom/server";

import { createJourneyMachine, type JourneyDefinition } from "@/src/core";
import { JourneyProvider, JourneyStepRenderer, type JourneyReactDefinition } from "@/src/react";

type StepId = "server";
type Event = "next";
type Ctx = { value: number };

const ServerStep = () => <div>server-step</div>;

const reactJourney: JourneyReactDefinition<Ctx, StepId, Event> = {
  initial: "server",
  context: { value: 1 },
  steps: {
    server: { component: ServerStep }
  },
  transitions: []
};

describe("SSR / RSC compatibility", () => {
  it("can render provider + step renderer on the server", () => {
    const html = renderToString(
      <JourneyProvider journey={reactJourney}>
        <JourneyStepRenderer<Ctx, StepId, Event> />
      </JourneyProvider>
    );

    expect(html).toContain("server-step");
  });

  it("core machine works without browser globals", async () => {
    const journey: JourneyDefinition<Ctx, StepId, Event> = {
      initial: "server",
      context: { value: 1 },
      steps: {
        server: {}
      },
      transitions: []
    };

    const machine = createJourneyMachine(journey);
    const snapshot = machine.getSnapshot();

    expect(snapshot.current).toBe("server");
    expect(snapshot.context.value).toBe(1);
    await expect(machine.send({ type: "next" })).resolves.toEqual({
      transitioned: false,
      snapshot
    });
  });

  it("does not fail on server render when persistence is configured without storage", () => {
    const html = renderToString(
      <JourneyProvider journey={reactJourney} persistence={{ key: "server-journey" }}>
        <JourneyStepRenderer<Ctx, StepId, Event> />
      </JourneyProvider>
    );

    expect(html).toContain("server-step");
  });
});
