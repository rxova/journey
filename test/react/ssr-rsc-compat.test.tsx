// @vitest-environment node

import { describe, expect, it } from "vitest";

import React from "react";
import { renderToString } from "react-dom/server";

import { createFlowMachine, type FlowFlow } from "@/src/core";
import { FlowProvider, FlowStepRenderer, type FlowReactFlow } from "@/src/react";

type StepId = "server";
type Event = "next";
type Ctx = { value: number };

const ServerStep = () => <div>server-step</div>;

const reactFlow: FlowReactFlow<Ctx, StepId, Event> = {
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
      <FlowProvider flow={reactFlow}>
        <FlowStepRenderer<Ctx, StepId, Event> />
      </FlowProvider>
    );

    expect(html).toContain("server-step");
  });

  it("core machine works without browser globals", async () => {
    const flow: FlowFlow<Ctx, StepId, Event> = {
      initial: "server",
      context: { value: 1 },
      steps: {
        server: {}
      },
      transitions: []
    };

    const machine = createFlowMachine(flow);
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
      <FlowProvider flow={reactFlow} persistence={{ key: "server-flow" }}>
        <FlowStepRenderer<Ctx, StepId, Event> />
      </FlowProvider>
    );

    expect(html).toContain("server-step");
  });
});
