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
import { createGraphSnapshot } from "./fixtures";

const setNativeValue = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const prototype = Object.getPrototypeOf(element) as
    | typeof HTMLInputElement.prototype
    | typeof HTMLTextAreaElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (!descriptor?.set) {
    throw new Error("value setter not found");
  }
  descriptor.set.call(element, value);
};

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
        id: "core.goToStepById",
        label: "goToStepById",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: [{ key: "stepId", label: "stepId", type: "text", required: true }]
      },
      {
        id: "core.forceStepTransition",
        label: "forceStepTransition",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: [{ key: "stepId", label: "to", type: "text", required: true }]
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
        id: "core.updateContext",
        label: "replaceContext",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: [{ key: "context", label: "context", type: "json", required: true }]
      },
      {
        id: "core.patchContext",
        label: "patchContext",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: [
          { key: "key", label: "key", type: "text", required: true },
          { key: "value", label: "value", type: "json", required: true }
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
    mode: "graph",
    stepIds: ["start", "review", "done"],
    eventTypes: ["journey.start", "review.submit"],
    features
  },
  snapshot: createGraphSnapshot("start", {
    availableEvents: ["journey.start"],
    availableSteps: ["review", "done"]
  })
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
    snapshot: createGraphSnapshot("review", { timeline: ["start", "review"] }),
    transitioned: true
  }
});

const liveSnapshotEnvelope = (
  timestamp = 1002,
  currentStepId: "start" | "review" | "done" = "review",
  status: "idle" | "running" | "completed" | "terminated" = "running"
): Extract<JourneyDevtoolsBridgeEnvelope, { kind: "snapshot" }> => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "snapshot",
  machineId: "machine-1",
  timestamp,
  snapshot: createGraphSnapshot(currentStepId, {
    timeline: currentStepId === "start" ? ["start"] : ["start", currentStepId],
    status
  })
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
    if (!machine) {
      throw new Error("expected machine state");
    }
    expect(machine.snapshot.currentStep?.id).toBe("review");
    const lastEntry = machine.timelineEntries[machine.timelineEntries.length - 1];
    expect(lastEntry?.label).toBe("OP/core.goToNextStep");
    expect(lastEntry?.meta).not.toHaveProperty("transitionId");
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
          currentStepId="start"
          disabled={false}
          mutationsEnabled={true}
          mode="graph"
          stepIds={["start", "review", "done"]}
          eventTypes={["journey.start", "review.submit"]}
          eventTypesBySource={{
            start: ["journey.start"],
            review: ["review.submit"],
            "*": ["journey.start"]
          }}
          goToStepTargetsBySource={{ start: ["review"], review: ["done"], "*": ["done"] }}
          onInvoke={onInvoke}
        />
      );
    });

    expect(container.textContent).toContain("Navigation");
    expect(container.textContent).toContain("Events");
    expect(container.textContent).toContain("Machine commands");
    expect(container.textContent).toContain("restartJourney");

    const navigationSelect = [...container.querySelectorAll("select")].find(
      (select) => select.querySelector('option[value="review"]') !== null
    );
    expect(navigationSelect).toBeTruthy();
    expect(navigationSelect?.querySelector('option[value="review"]')).toBeTruthy();
    expect(navigationSelect?.querySelector('option[value="done"]')).toBeTruthy();
    expect(navigationSelect?.querySelector('option[value="start"]')).toBeNull();

    const eventTypeSelect = [...container.querySelectorAll("select")].find((select) =>
      [...select.querySelectorAll("option")].some(
        (option) => option.textContent === "journey.start"
      )
    );
    expect(eventTypeSelect).toBeTruthy();
    expect(eventTypeSelect?.querySelector('option[value="journey.start"]')).toBeTruthy();
    expect(eventTypeSelect?.querySelector('option[value="review.submit"]')).toBeNull();

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
          currentStepId="start"
          disabled={false}
          mutationsEnabled={true}
          mode="graph"
          stepIds={["start", "review", "done"]}
          eventTypes={["journey.start", "review.submit"]}
          eventTypesBySource={{
            start: ["journey.start"],
            review: ["review.submit"],
            "*": ["journey.start"]
          }}
          goToStepTargetsBySource={{ start: ["review"], review: ["done"], "*": ["done"] }}
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

  it("keeps live running state when a later snapshot arrives after restart", () => {
    let state: JourneyPanelState = createInitialPanelState();
    state = panelReducer(state, { type: "bridge-envelope", envelope: registerEnvelope() });
    state = panelReducer(state, {
      type: "queue-command",
      machineId: "machine-1",
      requestId: "req-1",
      invocation: { operationId: "core.resetJourney" },
      timestamp: 1000
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: liveSnapshotEnvelope(1002, "start", "running")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: {
        ...operationResultEnvelope(),
        timestamp: 1001,
        operationId: "core.resetJourney",
        result: {
          kind: "snapshot",
          snapshot: createGraphSnapshot(null, { status: "idle" })
        }
      }
    });

    expect(state.machines["machine-1"]?.snapshot.status).toBe("running");
  });

  it("shows all step ids for headless goToStepById", async () => {
    const onInvoke = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <CommandControls
          features={features}
          snapshotStatus="running"
          currentStepId="start"
          disabled={false}
          mutationsEnabled={true}
          mode="headless"
          stepIds={["start", "review", "done"]}
          eventTypes={["journey.start", "review.submit"]}
          eventTypesBySource={{}}
          goToStepTargetsBySource={{}}
          onInvoke={onInvoke}
        />
      );
    });

    const navigationSelect = [...container.querySelectorAll("select")].find(
      (select) => select.querySelector('option[value="start"]') !== null
    );
    expect(navigationSelect?.querySelector('option[value="start"]')).toBeTruthy();
    expect(navigationSelect?.querySelector('option[value="review"]')).toBeTruthy();
    expect(navigationSelect?.querySelector('option[value="done"]')).toBeTruthy();

    root.unmount();
  });

  it("shows inline json validation and dispatches patchContext with parsed values", async () => {
    const onInvoke = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <CommandControls
          features={features}
          snapshotStatus="running"
          currentStepId="start"
          disabled={false}
          mutationsEnabled={true}
          mode="graph"
          stepIds={["start", "review", "done"]}
          eventTypes={["journey.start", "review.submit"]}
          eventTypesBySource={{
            start: ["journey.start"],
            review: ["review.submit"],
            "*": ["journey.start"]
          }}
          goToStepTargetsBySource={{ start: ["review"], review: ["done"], "*": ["done"] }}
          onInvoke={onInvoke}
        />
      );
    });

    const patchButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "patchContext"
    );
    if (!patchButton) {
      throw new Error("patchContext button not found");
    }

    const patchForm = patchButton.closest("div");
    if (!patchForm) {
      throw new Error("patchContext form not found");
    }

    const keyInput = [...patchForm.querySelectorAll("input")].find((input) =>
      input.parentElement?.textContent?.includes("key")
    );
    const valueTextarea = [...patchForm.querySelectorAll("textarea")].find((textarea) =>
      textarea.parentElement?.textContent?.includes("value")
    );

    if (!keyInput || !valueTextarea) {
      throw new Error("patchContext fields not found");
    }

    await act(async () => {
      setNativeValue(keyInput, "attempts");
      keyInput.dispatchEvent(new Event("input", { bubbles: true }));
      setNativeValue(valueTextarea, "{oops");
      valueTextarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(valueTextarea.getAttribute("aria-invalid")).toBe("true");
    expect(container.textContent).toContain("JSON fields must contain valid JSON.");
    expect(patchButton.hasAttribute("disabled")).toBe(true);

    await act(async () => {
      setNativeValue(valueTextarea, "2");
      valueTextarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(valueTextarea.getAttribute("aria-invalid")).toBeNull();
    expect(container.textContent).not.toContain("JSON fields must contain valid JSON.");
    expect(patchButton.hasAttribute("disabled")).toBe(false);

    await act(async () => {
      patchButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onInvoke).toHaveBeenCalledWith({
      operationId: "core.patchContext",
      input: { key: "attempts", value: 2 }
    });

    await act(async () => {
      root.unmount();
    });
  });
});
