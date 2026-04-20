import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  type JourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsMachineFeatureDescriptor
} from "@rxova/journey-devtools-bridge";
import { CommandControls } from "../src/panel/components/CommandControls";
import { createInitialPanelState, panelReducer, type JourneyPanelState } from "../src/panel/store";
import {
  createInvokeEnvelope,
  createTransportErrorEnvelope,
  isBackgroundToContentMessage,
  isPanelToBackgroundMessage
} from "../src/shared";

const features: JourneyDevtoolsMachineFeatureDescriptor[] = [
  {
    id: "core",
    label: "Core",
    description: null,
    operations: [
      {
        id: "core.startJourney",
        label: "startJourney",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: []
      },
      {
        id: "core.resetJourney",
        label: "resetJourney",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: []
      },
      {
        id: "core.goToNextStep",
        label: "goToNextStep",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: []
      },
      {
        id: "core.sendEvent",
        label: "send",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: [
          { key: "type", label: "type", type: "text", required: true },
          { key: "payload", label: "payload", type: "json" }
        ]
      },
      {
        id: "core.completeJourney",
        label: "completeJourney",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: []
      },
      {
        id: "core.terminateJourney",
        label: "terminateJourney",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: []
      },
      {
        id: "core.clearStepError",
        label: "clearStepError",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: [{ key: "stepId", label: "stepId", type: "text" }]
      }
    ]
  }
];

const registerEnvelope = (): Extract<JourneyDevtoolsBridgeEnvelope, { kind: "register" }> => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "register",
  machineId: "machine-1",
  timestamp: 1000,
  meta: {
    machineId: "machine-1",
    label: "Checkout",
    appName: "Store",
    mutationsEnabled: true,
    features
  },
  snapshot: {
    currentStepId: "start",
    history: { timeline: ["start"], index: 0 },
    context: {},
    visited: { start: true },
    status: "running",
    async: { isLoading: false, byStep: {} }
  }
});

const operationResultEnvelope = (): Extract<
  JourneyDevtoolsBridgeEnvelope,
  { kind: "operationResult" }
> => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "operationResult",
  machineId: "machine-1",
  timestamp: 1001,
  requestId: "req-1",
  operationId: "core.goToNextStep",
  result: {
    kind: "snapshot",
    snapshot: {
      currentStepId: "review",
      history: { timeline: ["start", "review"], index: 1 },
      context: {},
      visited: { start: true, review: true },
      status: "running",
      async: { isLoading: false, byStep: {} }
    },
    transitioned: true,
    transitionId: "goToNextStep"
  }
});

describe("generic devtools operations", () => {
  it("creates and validates generic invoke envelopes", () => {
    const envelope = createInvokeEnvelope("machine-1", "req-1", {
      operationId: "core.goToNextStep"
    });

    expect(
      isPanelToBackgroundMessage({
        type: "panel-command",
        tabId: 1,
        envelope
      })
    ).toBe(true);
    expect(
      isBackgroundToContentMessage({
        type: "extension-envelope",
        envelope
      })
    ).toBe(true);

    const transportError = createTransportErrorEnvelope("machine-1", "req-1", {
      name: "Error",
      message: "boom",
      stack: null,
      cause: null
    });
    expect(transportError.kind).toBe("operationError");
    expect(transportError.operationId).toBe("transport");
  });

  it("correlates queued operations with generic operation results", () => {
    let state: JourneyPanelState = createInitialPanelState();
    state = panelReducer(state, { type: "bridge-envelope", envelope: registerEnvelope() });
    state = panelReducer(state, {
      type: "queue-command",
      machineId: "machine-1",
      requestId: "req-1",
      invocation: { operationId: "core.goToNextStep" },
      timestamp: 1000
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: operationResultEnvelope()
    });

    const machine = state.machines["machine-1"];
    expect(machine.snapshot.currentStepId).toBe("review");
    expect(machine.timelineEntries.at(-1)?.label).toBe("OP/core.goToNextStep");
    expect(machine.timelineEntries.at(-1)?.meta.transitionId).toBe("goToNextStep");
  });

  it("renders generic feature-driven controls and dispatches invocations", async () => {
    const onInvoke = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <CommandControls
          features={features}
          snapshotStatus="running"
          disabled={false}
          mutationsEnabled={true}
          onInvoke={onInvoke}
        />
      );
    });

    expect(container.textContent).toContain("Navigation");
    expect(container.textContent).toContain("Events");
    expect(container.textContent).toContain("Machine commands");
    expect(container.textContent).toContain("restartJourney");

    const nextButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("goToNextStep")
    );
    if (!nextButton) {
      throw new Error("generic operation button not found");
    }

    await act(async () => {
      nextButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onInvoke).toHaveBeenCalledWith({ operationId: "core.goToNextStep" });

    root.unmount();
  });

  it("disables lifecycle buttons based on snapshot status", async () => {
    const onInvoke = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <CommandControls
          features={features}
          snapshotStatus="terminated"
          disabled={false}
          mutationsEnabled={true}
          onInvoke={onInvoke}
        />
      );
    });

    const buttons = [...container.querySelectorAll("button")];
    const startButton = buttons.find((button) => button.textContent === "startJourney");
    const restartButton = buttons.find((button) => button.textContent === "restartJourney");
    const terminateButton = buttons.find((button) => button.textContent === "terminateJourney");
    const completeButton = buttons.find((button) => button.textContent === "completeJourney");

    expect(startButton?.hasAttribute("disabled")).toBe(true);
    expect(restartButton?.hasAttribute("disabled")).toBe(false);
    expect(terminateButton?.hasAttribute("disabled")).toBe(true);
    expect(completeButton?.hasAttribute("disabled")).toBe(true);

    root.unmount();
  });
});
