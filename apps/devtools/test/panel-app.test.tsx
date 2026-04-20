import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  type JourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsSerializableSnapshot
} from "@rxova/journey-devtools-bridge";
import { JOURNEY_DEVTOOLS_PANEL_PORT } from "../src/shared";
import { App } from "../src/panel/App";

type Listener<TArgs extends unknown[]> = (...args: TArgs) => void;

const createListenerSet = <TArgs extends unknown[]>() => {
  const listeners = new Set<Listener<TArgs>>();

  return {
    addListener: (listener: Listener<TArgs>) => {
      listeners.add(listener);
    },
    removeListener: (listener: Listener<TArgs>) => {
      listeners.delete(listener);
    },
    emit: (...args: TArgs) => {
      for (const listener of listeners) {
        listener(...args);
      }
    }
  };
};

class MockPort {
  public readonly postedMessages: unknown[] = [];
  private readonly onMessageListeners = createListenerSet<[unknown]>();
  private readonly onDisconnectListeners = createListenerSet<[]>();

  public readonly name = JOURNEY_DEVTOOLS_PANEL_PORT;
  public readonly onMessage = {
    addListener: this.onMessageListeners.addListener,
    removeListener: this.onMessageListeners.removeListener
  };
  public readonly onDisconnect = {
    addListener: this.onDisconnectListeners.addListener,
    removeListener: this.onDisconnectListeners.removeListener
  };

  public postMessage(message: unknown) {
    this.postedMessages.push(message);
  }

  public disconnect() {
    this.onDisconnectListeners.emit();
  }

  public emitMessage(message: unknown) {
    this.onMessageListeners.emit(message);
  }
}

const createSnapshot = (currentStepId: string): JourneyDevtoolsSerializableSnapshot => ({
  currentStepId,
  history: {
    timeline: currentStepId === "start" ? ["start"] : ["start", currentStepId],
    index: currentStepId === "start" ? 0 : 1
  },
  context: { count: currentStepId.length },
  visited: currentStepId === "start" ? { start: true } : { start: true, [currentStepId]: true },
  status: "running",
  async: { isLoading: false, byStep: {} }
});

const createRegisterEnvelope = (machineId: string): JourneyDevtoolsBridgeEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "register",
  machineId,
  timestamp: Date.now(),
  meta: {
    machineId,
    label: "Checkout",
    appName: "Store",
    mutationsEnabled: true,
    mode: "graph",
    stepIds: ["start", "review"],
    eventTypes: ["submitLogin"],
    eventTypesBySource: { start: ["submitLogin"] },
    goToStepTargetsBySource: { start: ["review"] },
    features: [
      {
        id: "core",
        label: "Core",
        description: null,
        operations: [
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
          }
        ]
      }
    ]
  },
  snapshot: createSnapshot("start")
});

const createSnapshotEnvelope = (
  machineId: string,
  currentStepId: string
): JourneyDevtoolsBridgeEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "snapshot",
  machineId,
  timestamp: Date.now(),
  snapshot: createSnapshot(currentStepId)
});

describe("panel app integration", () => {
  let container: HTMLDivElement;
  let root: Root;
  let port: MockPort;
  let connectMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    port = new MockPort();
    connectMock = vi.fn(() => port as unknown as chrome.runtime.Port);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
    vi.stubGlobal("chrome", {
      runtime: {
        connect: connectMock
      },
      devtools: {
        inspectedWindow: {
          tabId: 42
        }
      }
    });
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "req-fixed")
    } as unknown as Crypto);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders live bridge state and dispatches panel commands", async () => {
    await act(async () => {
      root.render(<App />);
    });

    expect(connectMock).toHaveBeenCalledWith({ name: JOURNEY_DEVTOOLS_PANEL_PORT });
    expect(port.postedMessages[0]).toEqual({ type: "panel-init", tabId: 42 });
    expect(container.textContent).toContain("No Active Machine");

    await act(async () => {
      port.emitMessage({
        type: "panel-warning",
        warning: {
          code: "injection-failed",
          message: "Injection failed",
          recoverable: true,
          tabId: 42
        }
      });
      port.emitMessage({ type: "panel-connected", connected: true });
      port.emitMessage({ type: "invalid" });
      port.emitMessage({ type: "panel-bridge-envelope", envelope: { bad: true } });
      port.emitMessage({
        type: "panel-bridge-envelope",
        envelope: createRegisterEnvelope("machine-1")
      });
      port.emitMessage({
        type: "panel-bridge-envelope",
        envelope: createSnapshotEnvelope("machine-1", "review")
      });
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Connected to inspected tab");
    expect(container.textContent).not.toContain("Injection failed");
    expect(container.textContent).toContain("Journey Machines");
    expect(container.textContent).toContain("Showing 2 / 2");
    expect(container.textContent).toContain("SNAPSHOT/review");
    expect(container.textContent).toContain("goToNextStep");

    const nextButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "goToNextStep"
    );
    if (!nextButton) {
      throw new Error("missing goToNextStep button");
    }

    await act(async () => {
      nextButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(port.postedMessages).toContainEqual({
      type: "panel-command",
      tabId: 42,
      envelope: expect.objectContaining({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: "rxova-journey-extension",
        kind: "invoke",
        machineId: "machine-1",
        requestId: "req-fixed",
        invocation: { operationId: "core.goToNextStep" }
      })
    });

    const toggleButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.getAttribute("aria-label") === "Collapse Timeline"
    );
    if (!toggleButton) {
      throw new Error("missing timeline toggle");
    }

    await act(async () => {
      toggleButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).not.toContain("Prune to limit");

    await act(async () => {
      port.emitMessage({ type: "panel-connected", connected: false });
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(1300);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("No Active Machine");
  });
});
