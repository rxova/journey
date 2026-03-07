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
  currentStepId: current,
  history: {
    timeline: current === "start" ? ["start"] : ["start", current],
    index: current === "start" ? 0 : 1
  },
  context: { count: current.length },
  visited: current === "start" ? { start: true } : { start: true, [current]: true },
  stepMeta: {},
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

const createCommandResultEnvelope = (
  machineId: string,
  requestId: string,
  current: string
): JourneyDevtoolsBridgeEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "commandResult",
  machineId,
  timestamp: Date.now(),
  requestId,
  transitioned: true,
  transitionId: "goToNextStep",
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
      onMessage.emit({
        type: "panel-bridge-envelope",
        envelope: createRegisterEnvelope("machine-2")
      });
    });

    expect(container.textContent).toContain("Connected to inspected tab");
    expect(container.textContent).toContain("Injection failed");
    expect(container.textContent).toContain("Checkout (Store)");
    expect(container.textContent).toContain("Showing 2 / 2");
    expect(container.textContent).toContain("@@INIT");
    expect(container.textContent).toContain("SNAPSHOT/review");

    const machineSelect = container.querySelector("select") as HTMLSelectElement | null;
    if (!machineSelect) {
      throw new Error("machine selector not found");
    }
    const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    await act(async () => {
      selectSetter?.call(machineSelect, "machine-2");
      machineSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(machineSelect.value).toBe("machine-2");
    await act(async () => {
      selectSetter?.call(machineSelect, "machine-1");
      machineSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(machineSelect.value).toBe("machine-1");

    const followLatestButton = Array.from(container.querySelectorAll("button")).find(
      (entry) => entry.textContent?.trim() === "Following latest"
    );
    if (!followLatestButton) {
      throw new Error("follow latest button not found");
    }
    await act(async () => {
      followLatestButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const firstTimelineLabel = Array.from(container.querySelectorAll(".timeline-label")).find(
      (entry) => entry.textContent?.trim() === "@@INIT"
    );
    if (!firstTimelineLabel) {
      throw new Error("timeline row for @@INIT not found");
    }
    const firstTimelineRow = firstTimelineLabel.closest("button");
    if (!firstTimelineRow) {
      throw new Error("timeline row button not found");
    }
    await act(async () => {
      firstTimelineRow.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).toContain('"type": "@@INIT"');

    const nextButton = Array.from(container.querySelectorAll("button")).find(
      (entry) => entry.textContent?.trim() === "goToNextStep"
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
    if (!panelCommand) {
      throw new Error("panel command message not found");
    }
    expect(panelCommand?.tabId).toBe(42);
    expect(panelCommand?.envelope.command.type).toBe("goToNextStep");
    expect(panelCommand?.envelope.requestId.startsWith("req-")).toBe(true);

    await act(async () => {
      onMessage.emit({
        type: "panel-bridge-envelope",
        envelope: createCommandResultEnvelope("machine-1", panelCommand.envelope.requestId, "done")
      });
    });
    expect(container.textContent).toContain("COMMAND/goToNextStep");

    const resetButton = Array.from(container.querySelectorAll("button")).find(
      (entry) => entry.textContent?.trim() === "resetMachine"
    );
    if (!resetButton) {
      throw new Error("reset button not found");
    }
    await act(async () => {
      resetButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const panelCommands = postedMessages.filter(
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
    const resetCommand = panelCommands[panelCommands.length - 1];
    if (!resetCommand) {
      throw new Error("reset command message not found");
    }
    await act(async () => {
      onMessage.emit({
        type: "panel-bridge-envelope",
        envelope: createCommandResultEnvelope("machine-1", resetCommand.envelope.requestId, "start")
      });
    });
    expect(container.textContent).toContain("COMMAND/resetMachine");

    const displayLimitInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      inputSetter?.call(displayLimitInput, "1");
      displayLimitInput.dispatchEvent(new Event("input", { bubbles: true }));
      displayLimitInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.textContent).toContain("Showing 1 / 4");

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
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(container.textContent).toContain("Waiting for bridge messages");
    const commandsBeforeNoPortClick = postedMessages.filter(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        (entry as { type?: string }).type === "panel-command"
    ).length;
    await act(async () => {
      nextButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const commandsAfterNoPortClick = postedMessages.filter(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        (entry as { type?: string }).type === "panel-command"
    ).length;
    expect(commandsAfterNoPortClick).toBe(commandsBeforeNoPortClick);

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(connect).toHaveBeenCalledTimes(2);

    await act(async () => {
      root.unmount();
    });

    await act(async () => {
      onDisconnect.emit();
    });
    expect(port.disconnect).toHaveBeenCalledTimes(1);
  });

  it("uses crypto.randomUUID when available", async () => {
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

    vi.stubGlobal("crypto", {
      randomUUID: () => "uuid-123"
    } as unknown as Crypto);
    vi.stubGlobal("chrome", {
      runtime: {
        connect: vi.fn(() => port)
      },
      devtools: {
        inspectedWindow: {
          tabId: 78
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
        envelope: createRegisterEnvelope("machine-uuid")
      });
    });

    const nextButton = Array.from(container.querySelectorAll("button")).find(
      (entry) => entry.textContent?.trim() === "goToNextStep"
    );
    if (!nextButton) {
      throw new Error("next button not found");
    }
    await act(async () => {
      nextButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const command = postedMessages.find(
      (entry): entry is { type: "panel-command"; envelope: { requestId: string } } =>
        typeof entry === "object" &&
        entry !== null &&
        "type" in entry &&
        (entry as { type?: string }).type === "panel-command"
    );
    expect(command?.envelope.requestId).toBe("uuid-123");

    await act(async () => {
      root.unmount();
    });
  });

  it("clears timeline when the inspected tab disconnects during reload", async () => {
    vi.useFakeTimers();
    const onMessage = createListenerSet<[unknown]>();

    const port = {
      postMessage: vi.fn(),
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
          tabId: 33
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
        envelope: createRegisterEnvelope("machine-reload")
      });
      onMessage.emit({
        type: "panel-bridge-envelope",
        envelope: createSnapshotEnvelope("machine-reload", "review")
      });
    });

    expect(container.textContent).toContain("Showing 2 / 2");
    expect(container.textContent).toContain("SNAPSHOT/review");

    await act(async () => {
      onMessage.emit({ type: "panel-connected", connected: false });
    });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(container.textContent).toContain("Waiting for bridge messages");
    expect(container.textContent).toContain("SNAPSHOT/review");
    expect(container.textContent).toContain("Showing 2 / 2");

    await act(async () => {
      vi.advanceTimersByTime(950);
    });

    expect(container.textContent).toContain("No Active Machine");
    expect(container.textContent).not.toContain("SNAPSHOT/review");
    expect(container.textContent).not.toContain("Showing 2 / 2");

    await act(async () => {
      root.unmount();
    });
  });

  it("clears a pending machine reset timer when the panel unmounts", async () => {
    vi.useFakeTimers();
    const onMessage = createListenerSet<[unknown]>();

    const port = {
      postMessage: vi.fn(),
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

    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

    vi.stubGlobal("chrome", {
      runtime: {
        connect: vi.fn(() => port)
      },
      devtools: {
        inspectedWindow: {
          tabId: 134
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
        envelope: createRegisterEnvelope("machine-unmount-pending-clear")
      });
      onMessage.emit({ type: "panel-connected", connected: false });
    });

    await act(async () => {
      root.unmount();
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("clears a pending machine reset timer when the port disconnects", async () => {
    vi.useFakeTimers();
    const onMessage = createListenerSet<[unknown]>();
    const onDisconnect = createListenerSet<[]>();

    const port = {
      postMessage: vi.fn(),
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

    vi.stubGlobal("chrome", {
      runtime: {
        connect: vi.fn(() => port)
      },
      devtools: {
        inspectedWindow: {
          tabId: 135
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
        envelope: createRegisterEnvelope("machine-disconnect-pending-clear")
      });
      onMessage.emit({ type: "panel-connected", connected: false });
      onDisconnect.emit();
      vi.advanceTimersByTime(1200);
    });

    expect(container.textContent).toContain("Checkout (Store)");
    expect(container.textContent).not.toContain("No Active Machine");

    await act(async () => {
      root.unmount();
    });
  });

  it("keeps timeline state on transient disconnect that quickly recovers", async () => {
    vi.useFakeTimers();
    const onMessage = createListenerSet<[unknown]>();

    const port = {
      postMessage: vi.fn(),
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
          tabId: 34
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
        envelope: createRegisterEnvelope("machine-recover")
      });
      onMessage.emit({
        type: "panel-bridge-envelope",
        envelope: createSnapshotEnvelope("machine-recover", "review")
      });
    });
    expect(container.textContent).toContain("SNAPSHOT/review");

    await act(async () => {
      onMessage.emit({ type: "panel-connected", connected: false });
      vi.advanceTimersByTime(300);
      onMessage.emit({ type: "panel-connected", connected: true });
      vi.advanceTimersByTime(1200);
    });

    expect(container.textContent).toContain("Connected to inspected tab");
    expect(container.textContent).toContain("Showing 2 / 2");
    expect(container.textContent).toContain("SNAPSHOT/review");
    expect(container.textContent).not.toContain("No Active Machine");

    await act(async () => {
      root.unmount();
    });
  });

  it("retries after runtime.connect throws", async () => {
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
    connect.mockImplementationOnce(() => {
      throw new Error("runtime unavailable");
    });

    vi.stubGlobal("chrome", {
      runtime: { connect },
      devtools: {
        inspectedWindow: {
          tabId: 88
        }
      }
    } as unknown as typeof chrome);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });
    expect(container.textContent).toContain("Waiting for bridge messages");

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(connect).toHaveBeenCalledTimes(2);
    expect(postedMessages).toContainEqual({ type: "panel-init", tabId: 88 });

    await act(async () => {
      root.unmount();
    });
  });

  it("aborts pending reconnect callbacks after unmount", async () => {
    const connect = vi.fn(() => {
      throw new Error("runtime unavailable");
    });
    let scheduledReconnect: (() => void) | null = null;
    vi.spyOn(window, "setTimeout").mockImplementation(((
      handler: Parameters<typeof window.setTimeout>[0]
    ) => {
      if (typeof handler === "function") {
        scheduledReconnect = handler as () => void;
      }
      return 1;
    }) as typeof window.setTimeout);
    vi.spyOn(window, "clearTimeout").mockImplementation(() => undefined);

    vi.stubGlobal("chrome", {
      runtime: { connect },
      devtools: {
        inspectedWindow: {
          tabId: 99
        }
      }
    } as unknown as typeof chrome);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });
    expect(connect).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });

    await act(async () => {
      scheduledReconnect?.();
    });

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("no-ops command dispatch when connection state is true but port ref is cleared", async () => {
    const onMessageListeners: Array<(message: unknown) => void> = [];
    const onDisconnectListeners: Array<() => void> = [];
    const postedMessages: unknown[] = [];

    const port = {
      postMessage: (message: unknown) => {
        postedMessages.push(message);
      },
      disconnect: vi.fn(),
      onMessage: {
        addListener: (listener: (message: unknown) => void) => {
          onMessageListeners.push(listener);
        },
        removeListener: vi.fn()
      },
      onDisconnect: {
        addListener: (listener: () => void) => {
          onDisconnectListeners.push(listener);
        },
        removeListener: vi.fn()
      }
    } as unknown as chrome.runtime.Port;

    vi.stubGlobal("chrome", {
      runtime: {
        connect: vi.fn(() => port)
      },
      devtools: {
        inspectedWindow: {
          tabId: 111
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
      onMessageListeners.forEach((listener) =>
        listener({ type: "panel-connected", connected: true })
      );
      onMessageListeners.forEach((listener) =>
        listener({
          type: "panel-bridge-envelope",
          envelope: createRegisterEnvelope("machine-nil-port")
        })
      );
    });

    const nextButton = Array.from(container.querySelectorAll("button")).find(
      (entry) => entry.textContent?.trim() === "goToNextStep"
    );
    if (!nextButton) {
      throw new Error("next button not found");
    }

    const commandCountBeforeDisconnect = postedMessages.filter(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        (entry as { type?: string }).type === "panel-command"
    ).length;

    await act(async () => {
      onDisconnectListeners.forEach((listener) => listener());
      onMessageListeners.forEach((listener) =>
        listener({ type: "panel-connected", connected: true })
      );
      nextButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const commandCountAfterDisconnect = postedMessages.filter(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        (entry as { type?: string }).type === "panel-command"
    ).length;
    expect(commandCountAfterDisconnect).toBe(commandCountBeforeDisconnect);

    await act(async () => {
      root.unmount();
    });
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
      (entry) => entry.textContent?.trim() === "goToNextStep"
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
