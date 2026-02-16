import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  type JourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsSerializableSnapshot
} from "@rxova/journey-devtools-bridge";
import { JOURNEY_DEVTOOLS_PANEL_PORT } from "../src/shared";
import { App } from "../src/panel/App";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const createSnapshot = (current: string): JourneyDevtoolsSerializableSnapshot => ({
  current,
  context: { count: current.length },
  history: current === "start" ? [] : ["start"],
  visited: current === "start" ? ["start"] : ["start", current],
  status: "running",
  async: {
    isLoading: false,
    byStep: {
      start: {
        phase: "idle",
        eventType: null,
        transitionId: null,
        error: null
      }
    }
  }
});

const createRegisterEnvelope = (
  machineId: string,
  options: { commandsEnabled?: boolean } = {}
): JourneyDevtoolsBridgeEnvelope => ({
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
    ...(options.commandsEnabled === undefined
      ? {}
      : {
          commandsEnabled: options.commandsEnabled
        })
  },
  snapshot: createSnapshot("start")
});

const createSnapshotEnvelope = (
  machineId: string,
  current: string
): JourneyDevtoolsBridgeEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "snapshot",
  machineId,
  timestamp: Date.now(),
  snapshot: createSnapshot(current)
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("panel App", () => {
  it("wires chrome runtime port messages and sends panel commands", async () => {
    vi.useFakeTimers();
    const onMessage = createListenerSet<[unknown]>();
    const onDisconnect = createListenerSet<[]>();
    const postedMessages: unknown[] = [];

    const port = {
      postMessage: (message: unknown) => {
        postedMessages.push(message);
      },
      disconnect: vi.fn(),
      onMessage: {
        addListener: onMessage.addListener,
        removeListener: onMessage.removeListener
      },
      onDisconnect: {
        addListener: onDisconnect.addListener,
        removeListener: onDisconnect.removeListener
      }
    } as unknown as chrome.runtime.Port;

    const connect = vi.fn(() => port);
    vi.stubGlobal("crypto", {} as Crypto);

    vi.stubGlobal("chrome", {
      runtime: {
        connect
      },
      devtools: {
        inspectedWindow: {
          tabId: 42
        }
      }
    } as unknown as typeof chrome);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    expect(connect).toHaveBeenCalledWith({ name: JOURNEY_DEVTOOLS_PANEL_PORT });
    expect(postedMessages[0]).toEqual({ type: "panel-init", tabId: 42 });
    expect(container.textContent).toContain("No Active Machine");

    await act(async () => {
      onMessage.emit({ type: "panel-connected", connected: true });
      onMessage.emit({
        type: "panel-warning",
        warning: {
          code: "injection-failed",
          message: "Injection failed",
          tabId: 42,
          recoverable: true
        }
      });
      onMessage.emit({ type: "invalid" });
      onMessage.emit({ type: "panel-bridge-envelope", envelope: { bad: true } });
      onMessage.emit({
        type: "panel-bridge-envelope",
        envelope: createRegisterEnvelope("machine-1")
      });
      onMessage.emit({
        type: "panel-bridge-envelope",
        envelope: createSnapshotEnvelope("machine-1", "review")
      });
    });

    expect(container.textContent).toContain("Connected to inspected tab");
    expect(container.textContent).toContain("Injection failed");
    expect(container.textContent).toContain("Checkout (Store)");

    const nextButton = Array.from(container.querySelectorAll("button")).find(
      (entry) => entry.textContent?.trim() === "next"
    );
    if (!nextButton) {
      throw new Error("next button not found");
    }

    await act(async () => {
      nextButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const panelCommand = postedMessages.find(
      (
        entry
      ): entry is {
        type: "panel-command";
        tabId: number;
        envelope: { command: { type: string }; requestId: string };
      } =>
        typeof entry === "object" &&
        entry !== null &&
        "type" in entry &&
        (entry as { type?: string }).type === "panel-command"
    );

    expect(panelCommand).toBeDefined();
    expect(panelCommand?.tabId).toBe(42);
    expect(panelCommand?.envelope.command.type).toBe("next");
    expect(panelCommand?.envelope.requestId.startsWith("req-")).toBe(true);

    const displayLimitInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      inputSetter?.call(displayLimitInput, "1");
      displayLimitInput.dispatchEvent(new Event("input", { bubbles: true }));
      displayLimitInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const pruneButton = Array.from(container.querySelectorAll("button")).find(
      (entry) => entry.textContent?.trim() === "Prune to limit"
    );
    if (!pruneButton) {
      throw new Error("prune button not found");
    }
    await act(async () => {
      pruneButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      onDisconnect.emit();
    });

    expect(container.textContent).toContain("Waiting for bridge messages");

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(connect).toHaveBeenCalledTimes(2);

    await act(async () => {
      root.unmount();
    });

    expect(port.disconnect).toHaveBeenCalledTimes(1);
  });

  it("disables command controls when a machine reports commands disabled", async () => {
    const onMessage = createListenerSet<[unknown]>();
    const postedMessages: unknown[] = [];

    const port = {
      postMessage: (message: unknown) => {
        postedMessages.push(message);
      },
      disconnect: vi.fn(),
      onMessage: {
        addListener: onMessage.addListener,
        removeListener: onMessage.removeListener
      },
      onDisconnect: {
        addListener: vi.fn(),
        removeListener: vi.fn()
      }
    } as unknown as chrome.runtime.Port;

    vi.stubGlobal("chrome", {
      runtime: {
        connect: vi.fn(() => port)
      },
      devtools: {
        inspectedWindow: {
          tabId: 56
        }
      }
    } as unknown as typeof chrome);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      onMessage.emit({ type: "panel-connected", connected: true });
      onMessage.emit({
        type: "panel-bridge-envelope",
        envelope: createRegisterEnvelope("machine-commands-off", { commandsEnabled: false })
      });
    });

    const nextButton = Array.from(container.querySelectorAll("button")).find(
      (entry) => entry.textContent?.trim() === "next"
    ) as HTMLButtonElement | undefined;
    if (!nextButton) {
      throw new Error("next button not found");
    }

    expect(nextButton.disabled).toBe(true);
    expect(container.textContent).toContain("Commands are disabled for this machine.");
    expect(
      postedMessages.some((entry) => {
        if (typeof entry !== "object" || entry === null) {
          return false;
        }
        return (entry as { type?: string }).type === "panel-command";
      })
    ).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });
});
