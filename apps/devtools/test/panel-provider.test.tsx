import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  type JourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsProtocolVersion,
  type JourneyDevtoolsOperationInvoke
} from "@rxova/journey-devtools-bridge";
import { PanelProvider, usePanelActions, usePanelState } from "../src/panel/context/PanelProvider";
import { JOURNEY_DEVTOOLS_PANEL_PORT, type PanelWarning } from "../src/shared";

type PortListener = (message?: unknown) => void;

class MockPort {
  public readonly name: string;
  public readonly postedMessages: unknown[] = [];
  public disconnected = false;
  private readonly messageListeners = new Set<(message: unknown) => void>();
  private readonly disconnectListeners = new Set<PortListener>();

  public readonly onMessage = {
    addListener: (listener: (message: unknown) => void) => {
      this.messageListeners.add(listener);
    },
    removeListener: (listener: (message: unknown) => void) => {
      this.messageListeners.delete(listener);
    }
  };

  public readonly onDisconnect = {
    addListener: (listener: PortListener) => {
      this.disconnectListeners.add(listener);
    },
    removeListener: (listener: PortListener) => {
      this.disconnectListeners.delete(listener);
    }
  };

  public constructor(name: string) {
    this.name = name;
  }

  public postMessage(message: unknown) {
    this.postedMessages.push(message);
  }

  public emitMessage(message: unknown) {
    for (const listener of this.messageListeners) {
      listener(message);
    }
  }

  public disconnect() {
    this.disconnected = true;
    for (const listener of [...this.disconnectListeners]) {
      listener();
    }
  }
}

type HarnessSnapshot = ReturnType<typeof usePanelState>;
type HarnessActions = ReturnType<typeof usePanelActions>;

let latestState: HarnessSnapshot | null = null;
let latestActions: HarnessActions | null = null;

const TestConsumer = () => {
  const state = usePanelState();
  const actions = usePanelActions();

  React.useEffect(() => {
    latestState = state;
    latestActions = actions;
  }, [actions, state]);

  return null;
};

const createRegisterEnvelope = (
  machineId: string,
  version: number = JOURNEY_DEVTOOLS_PROTOCOL_VERSION
): Extract<JourneyDevtoolsBridgeEnvelope, { kind: "register" }> => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: version as JourneyDevtoolsProtocolVersion,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "register",
  machineId,
  timestamp: 1000,
  meta: {
    machineId,
    label: machineId,
    appName: "Test app",
    mutationsEnabled: true,
    mode: "graph",
    features: []
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

describe("PanelProvider bridge lifecycle", () => {
  let container: HTMLDivElement;
  let root: Root;
  let connectMock: ReturnType<typeof vi.fn>;
  let ports: MockPort[];

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    latestState = null;
    latestActions = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    ports = [];
    connectMock = vi.fn(() => {
      const port = new MockPort(JOURNEY_DEVTOOLS_PANEL_PORT);
      ports.push(port);
      return port;
    });

    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        runtime: {
          connect: connectMock
        },
        devtools: {
          inspectedWindow: {
            tabId: 7
          }
        }
      }
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("connects immediately and posts the panel init message", () => {
    act(() => {
      root.render(
        <PanelProvider>
          <TestConsumer />
        </PanelProvider>
      );
    });

    expect(connectMock).toHaveBeenCalledWith({ name: JOURNEY_DEVTOOLS_PANEL_PORT });
    expect(ports[0]?.postedMessages).toEqual([{ type: "panel-init", tabId: 7 }]);
    expect(latestState?.isCommandChannelReady).toBe(false);
    expect(latestState?.displayConnected).toBe(false);
  });

  it("updates state from connection, warning, and register messages", async () => {
    act(() => {
      root.render(
        <PanelProvider>
          <TestConsumer />
        </PanelProvider>
      );
    });

    const port = ports[0];
    if (!port) {
      throw new Error("expected active port");
    }

    const warning: PanelWarning = {
      code: "injection-failed",
      message: "failed",
      tabId: 7,
      recoverable: true
    };

    await act(async () => {
      port.emitMessage({ type: "panel-warning", warning });
      port.emitMessage({ type: "panel-connected", connected: true });
      await Promise.resolve();
    });

    await act(async () => {
      port.emitMessage({
        type: "panel-bridge-envelope",
        envelope: createRegisterEnvelope("machine-1")
      });
      await Promise.resolve();
    });

    expect(latestState?.connectionWarning).toBeNull();
    expect(latestState?.displayConnected).toBe(true);
    expect(latestState?.isCommandChannelReady).toBe(true);
    expect(latestState?.panelState.selectedMachineId).toBe("machine-1");
    expect(latestState?.panelState.machineOrder).toEqual(["machine-1"]);
    expect(latestState?.activeMachine?.meta.machineId).toBe("machine-1");
  });

  it("queues and posts commands when the selected machine protocol matches", async () => {
    act(() => {
      root.render(
        <PanelProvider>
          <TestConsumer />
        </PanelProvider>
      );
    });

    const port = ports[0];
    if (!port) {
      throw new Error("expected active port");
    }

    await act(async () => {
      port.emitMessage({ type: "panel-connected", connected: true });
      await Promise.resolve();
    });

    await act(async () => {
      port.emitMessage({
        type: "panel-bridge-envelope",
        envelope: createRegisterEnvelope("machine-1")
      });
      await Promise.resolve();
    });

    const actions = latestActions;
    if (!actions) {
      throw new Error("expected panel actions");
    }

    vi.spyOn(Date, "now").mockReturnValue(1234);
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000000"
    );

    await act(async () => {
      actions.invokeOperation("machine-1", {
        operationId: "core.goToNextStep"
      } satisfies JourneyDevtoolsOperationInvoke);
      await Promise.resolve();
    });

    expect(latestState?.panelState.machines["machine-1"]?.timelineEntries[1]?.requestId).toBe(
      "00000000-0000-4000-8000-000000000000"
    );
    expect(port.postedMessages[1]).toMatchObject({
      type: "panel-command",
      tabId: 7,
      envelope: {
        kind: "invoke",
        machineId: "machine-1",
        requestId: "00000000-0000-4000-8000-000000000000",
        invocation: {
          operationId: "core.goToNextStep"
        }
      }
    });
  });

  it("blocks commands and exposes a mismatch reason for legacy protocol machines", async () => {
    act(() => {
      root.render(
        <PanelProvider>
          <TestConsumer />
        </PanelProvider>
      );
    });

    const port = ports[0];
    if (!port) {
      throw new Error("expected active port");
    }

    await act(async () => {
      port.emitMessage({ type: "panel-connected", connected: true });
      await Promise.resolve();
    });

    await act(async () => {
      port.emitMessage({
        type: "panel-bridge-envelope",
        envelope: createRegisterEnvelope("machine-legacy", JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION)
      });
      await Promise.resolve();
    });

    const actions = latestActions;
    if (!actions) {
      throw new Error("expected panel actions");
    }

    await act(async () => {
      actions.invokeOperation("machine-legacy", { operationId: "core.goToNextStep" });
      await Promise.resolve();
    });

    expect(latestState?.protocolMismatchReason).toContain(
      `protocol v${JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION}`
    );
    expect(latestState?.areCommandsDisabled).toBe(true);
    expect(ports[0]?.postedMessages).toHaveLength(1);
  });

  it("clears visible connection state and machines after disconnect timers elapse", async () => {
    act(() => {
      root.render(
        <PanelProvider>
          <TestConsumer />
        </PanelProvider>
      );
    });

    const firstPort = ports[0];
    if (!firstPort) {
      throw new Error("expected active port");
    }

    await act(async () => {
      firstPort.emitMessage({ type: "panel-connected", connected: true });
      await Promise.resolve();
    });

    await act(async () => {
      firstPort.emitMessage({
        type: "panel-bridge-envelope",
        envelope: createRegisterEnvelope("machine-1")
      });
      await Promise.resolve();
    });

    expect(latestState?.displayConnected).toBe(true);
    expect(latestState?.panelState.machineOrder).toEqual(["machine-1"]);

    await act(async () => {
      firstPort.emitMessage({ type: "panel-connected", connected: false });
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(latestState?.displayConnected).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(950);
      await Promise.resolve();
    });
    expect(latestState?.panelState.machineOrder).toEqual([]);
  });

  it("reconnects after disconnect and tears down the old port", async () => {
    act(() => {
      root.render(
        <PanelProvider>
          <TestConsumer />
        </PanelProvider>
      );
    });

    const firstPort = ports[0];
    if (!firstPort) {
      throw new Error("expected active port");
    }

    await act(async () => {
      firstPort.disconnect();
      await Promise.resolve();
    });

    expect(latestState?.displayConnected).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });

    expect(connectMock).toHaveBeenCalledTimes(2);
    expect(firstPort.disconnected).toBe(true);
    expect(ports[1]?.postedMessages).toEqual([{ type: "panel-init", tabId: 7 }]);
  });
});
