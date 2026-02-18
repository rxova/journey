import { afterEach, describe, expect, it, vi } from "vitest";

import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  type JourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsSerializableSnapshot
} from "@rxova/journey-devtools-bridge";
import {
  JOURNEY_DEVTOOLS_PANEL_PORT,
  createCommandEnvelope,
  type ContentToBackgroundMessage,
  type PanelCommandMessage,
  type PanelInitMessage
} from "../src/shared";

type Listener<TArgs extends unknown[]> = (...args: TArgs) => void;

type ListenerSet<TArgs extends unknown[]> = {
  addListener: (listener: Listener<TArgs>) => void;
  removeListener: (listener: Listener<TArgs>) => void;
  emit: (...args: TArgs) => void;
};

const createListenerSet = <TArgs extends unknown[]>(): ListenerSet<TArgs> => {
  const listeners: Array<Listener<TArgs>> = [];

  return {
    addListener: (listener) => {
      listeners.push(listener);
    },
    removeListener: (listener) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    },
    emit: (...args) => {
      for (const listener of listeners) {
        listener(...args);
      }
    }
  };
};

type PortHarness = {
  port: chrome.runtime.Port;
  postedMessages: unknown[];
  emitMessage: (message: unknown) => void;
  emitDisconnect: () => void;
};

const createPortHarness = (name: string): PortHarness => {
  const onMessage = createListenerSet<[unknown]>();
  const onDisconnect = createListenerSet<[]>();
  const postedMessages: unknown[] = [];

  const port = {
    name,
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

  return {
    port,
    postedMessages,
    emitMessage: (message) => {
      onMessage.emit(message);
    },
    emitDisconnect: () => {
      onDisconnect.emit();
    }
  };
};

type SendMessageImpl = (tabId: number, message: unknown, callback?: () => void) => void;

type ChromeHarness = {
  chromeMock: typeof chrome;
  emitConnect: (port: chrome.runtime.Port) => void;
  emitRuntimeMessage: (message: unknown, sender: chrome.runtime.MessageSender) => void;
  emitTabRemoved: (tabId: number) => void;
  emitTabUpdated: (
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab
  ) => void;
  setSendMessageImpl: (impl: SendMessageImpl) => void;
  setRuntimeLastError: (error: Error | undefined) => void;
  sendMessage: ReturnType<typeof vi.fn>;
  executeScript: ReturnType<typeof vi.fn>;
};

const createChromeHarness = (): ChromeHarness => {
  const onConnect = createListenerSet<[chrome.runtime.Port]>();
  const onRuntimeMessage = createListenerSet<[unknown, chrome.runtime.MessageSender]>();
  const onTabRemoved = createListenerSet<[number, chrome.tabs.TabRemoveInfo]>();
  const onTabUpdated = createListenerSet<[number, chrome.tabs.TabChangeInfo, chrome.tabs.Tab]>();
  const runtimeState: { lastError: Error | undefined } = {
    lastError: undefined
  };

  let sendMessageImpl: SendMessageImpl = (_tabId, _message, callback) => {
    runtimeState.lastError = undefined;
    callback?.();
  };

  const sendMessage = vi.fn((tabId: number, message: unknown, callback?: () => void) => {
    sendMessageImpl(tabId, message, callback);
  });
  const executeScript = vi.fn(
    (_injection: unknown, callback?: (injectionResults?: unknown[]) => void) => {
      callback?.([]);
    }
  );

  const chromeMock = {
    runtime: {
      getManifest: () =>
        ({
          content_scripts: [{ js: ["src/content.ts"] }]
        }) as chrome.runtime.Manifest,
      onConnect: {
        addListener: onConnect.addListener
      },
      onMessage: {
        addListener: onRuntimeMessage.addListener
      },
      get lastError() {
        return runtimeState.lastError;
      }
    },
    tabs: {
      sendMessage,
      onRemoved: {
        addListener: onTabRemoved.addListener
      },
      onUpdated: {
        addListener: onTabUpdated.addListener
      }
    },
    scripting: {
      executeScript
    }
  } as unknown as typeof chrome;

  return {
    chromeMock,
    emitConnect: (port) => {
      onConnect.emit(port);
    },
    emitRuntimeMessage: (message, sender) => {
      onRuntimeMessage.emit(message, sender);
    },
    emitTabRemoved: (tabId) => {
      onTabRemoved.emit(tabId, { isWindowClosing: false, windowId: 1 });
    },
    emitTabUpdated: (tabId, changeInfo, tab) => {
      onTabUpdated.emit(tabId, changeInfo, tab);
    },
    setSendMessageImpl: (impl) => {
      sendMessageImpl = impl;
    },
    setRuntimeLastError: (error) => {
      runtimeState.lastError = error;
    },
    sendMessage,
    executeScript
  };
};

const baseSnapshot = (current: string): JourneyDevtoolsSerializableSnapshot => ({
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

let timestamp = 2000;
const nextTimestamp = (): number => {
  timestamp += 1;
  return timestamp;
};

const registerEnvelope = (machineId: string): JourneyDevtoolsBridgeEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "register",
  machineId,
  timestamp: nextTimestamp(),
  meta: {
    machineId,
    label: "Checkout",
    appName: "Storefront"
  },
  snapshot: baseSnapshot("start")
});

const snapshotEnvelope = (machineId: string, current: string): JourneyDevtoolsBridgeEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "snapshot",
  machineId,
  timestamp: nextTimestamp(),
  snapshot: baseSnapshot(current)
});

const commandResultEnvelope = (
  machineId: string,
  requestId: string
): JourneyDevtoolsBridgeEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "commandResult",
  machineId,
  timestamp: nextTimestamp(),
  requestId,
  snapshot: baseSnapshot("review"),
  transitioned: true,
  transitionId: "next"
});

const unregisterEnvelope = (machineId: string): JourneyDevtoolsBridgeEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "unregister",
  machineId,
  timestamp: nextTimestamp()
});

const asContentMessage = (envelope: JourneyDevtoolsBridgeEnvelope): ContentToBackgroundMessage => ({
  type: "bridge-envelope",
  envelope
});

const senderForTab = (tabId: number): chrome.runtime.MessageSender =>
  ({
    tab: {
      id: tabId
    }
  }) as chrome.runtime.MessageSender;

const loadBackground = async (): Promise<ChromeHarness> => {
  const harness = createChromeHarness();
  vi.stubGlobal("chrome", harness.chromeMock);
  await import("../src/background");
  return harness;
};

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("background message routing", () => {
  it("ignores non-panel ports", async () => {
    const harness = await loadBackground();
    const port = createPortHarness("other-port");

    harness.emitConnect(port.port);
    const init: PanelInitMessage = {
      type: "panel-init",
      tabId: 11
    };
    port.emitMessage(init);

    expect(port.postedMessages).toHaveLength(0);
  });

  it("sends disconnected status on panel init without cache", async () => {
    const harness = await loadBackground();
    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);

    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({
      type: "panel-init",
      tabId: 15
    } satisfies PanelInitMessage);

    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-connected",
      connected: false
    });
    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-warning",
      warning: null
    });
    expect(harness.executeScript).toHaveBeenCalledWith(
      {
        target: { tabId: 15 },
        files: ["src/content.ts"]
      },
      expect.any(Function)
    );
  });

  it("broadcasts a warning when content-script injection fails", async () => {
    const harness = await loadBackground();
    harness.setRuntimeLastError(new Error("Cannot access contents of the page"));
    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);

    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({
      type: "panel-init",
      tabId: 16
    } satisfies PanelInitMessage);

    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-warning",
      warning: {
        code: "injection-failed",
        message: "Content script injection failed: Cannot access contents of the page",
        recoverable: true,
        tabId: 16
      }
    });
    harness.setRuntimeLastError(undefined);
  });

  it("broadcasts bridge envelopes to connected panel ports", async () => {
    const harness = await loadBackground();
    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);

    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({
      type: "panel-init",
      tabId: 33
    } satisfies PanelInitMessage);

    const register = registerEnvelope("m-1");
    harness.emitRuntimeMessage(asContentMessage(register), senderForTab(33));

    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-connected",
      connected: true
    });
    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-bridge-envelope",
      envelope: register
    });

    const snapshot = snapshotEnvelope("m-1", "review");
    harness.emitRuntimeMessage(asContentMessage(snapshot), senderForTab(33));

    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-bridge-envelope",
      envelope: snapshot
    });
  });

  it("replays cached register and snapshot messages for new panel sessions", async () => {
    const harness = await loadBackground();

    const cachedRegister = registerEnvelope("m-2");
    const cachedSnapshot = snapshotEnvelope("m-2", "details");
    harness.emitRuntimeMessage(asContentMessage(cachedRegister), senderForTab(44));
    harness.emitRuntimeMessage(asContentMessage(cachedSnapshot), senderForTab(44));

    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);
    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({
      type: "panel-init",
      tabId: 44
    } satisfies PanelInitMessage);

    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-connected",
      connected: true
    });
    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-bridge-envelope",
      envelope: cachedRegister
    });
    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-bridge-envelope",
      envelope: cachedSnapshot
    });
  });

  it("routes panel commands to content script via tabs.sendMessage", async () => {
    const harness = await loadBackground();
    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);

    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({
      type: "panel-init",
      tabId: 50
    } satisfies PanelInitMessage);

    const envelope = createCommandEnvelope("m-3", "req-1", { type: "next" });
    panelPort.emitMessage({
      type: "panel-command",
      tabId: 50,
      envelope
    } satisfies PanelCommandMessage);

    expect(harness.sendMessage).toHaveBeenCalledTimes(1);
    expect(harness.sendMessage).toHaveBeenCalledWith(
      50,
      {
        type: "extension-envelope",
        envelope
      },
      expect.any(Function)
    );
  });

  it("broadcasts commandError envelopes when tab messaging fails", async () => {
    const harness = await loadBackground();
    harness.setSendMessageImpl((_tabId, _message, callback) => {
      harness.setRuntimeLastError(new Error("No receiver"));
      callback?.();
      harness.setRuntimeLastError(undefined);
    });

    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);
    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({
      type: "panel-init",
      tabId: 51
    } satisfies PanelInitMessage);

    const envelope = createCommandEnvelope("m-4", "req-error", { type: "next" });
    panelPort.emitMessage({
      type: "panel-command",
      tabId: 51,
      envelope
    } satisfies PanelCommandMessage);

    const errorMessage = panelPort.postedMessages.find((message) => {
      if (typeof message !== "object" || message === null) {
        return false;
      }
      const typed = message as { type?: string; envelope?: { kind?: string; requestId?: string } };
      return (
        typed.type === "panel-bridge-envelope" &&
        typed.envelope?.kind === "commandError" &&
        typed.envelope?.requestId === "req-error"
      );
    });

    expect(errorMessage).toBeDefined();
  });

  it("stops broadcasting to disconnected ports", async () => {
    const harness = await loadBackground();
    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);

    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({
      type: "panel-init",
      tabId: 61
    } satisfies PanelInitMessage);

    panelPort.emitDisconnect();
    const before = panelPort.postedMessages.length;

    harness.emitRuntimeMessage(asContentMessage(registerEnvelope("m-5")), senderForTab(61));
    expect(panelPort.postedMessages).toHaveLength(before);
  });

  it("broadcasts to all panel ports attached to the same tab", async () => {
    const harness = await loadBackground();
    const firstPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);
    const secondPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);

    harness.emitConnect(firstPort.port);
    firstPort.emitMessage({
      type: "panel-init",
      tabId: 71
    } satisfies PanelInitMessage);

    harness.emitConnect(secondPort.port);
    secondPort.emitMessage({
      type: "panel-init",
      tabId: 71
    } satisfies PanelInitMessage);

    const register = registerEnvelope("m-6");
    harness.emitRuntimeMessage(asContentMessage(register), senderForTab(71));

    expect(firstPort.postedMessages).toContainEqual({
      type: "panel-bridge-envelope",
      envelope: register
    });
    expect(secondPort.postedMessages).toContainEqual({
      type: "panel-bridge-envelope",
      envelope: register
    });
  });

  it("ignores runtime messages with missing tab sender", async () => {
    const harness = await loadBackground();
    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);

    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({
      type: "panel-init",
      tabId: 81
    } satisfies PanelInitMessage);

    const before = panelPort.postedMessages.length;
    harness.emitRuntimeMessage(
      asContentMessage(registerEnvelope("m-7")),
      {} as chrome.runtime.MessageSender
    );

    expect(panelPort.postedMessages).toHaveLength(before);
  });

  it("does not cache commandResult envelopes for replay", async () => {
    const harness = await loadBackground();

    harness.emitRuntimeMessage(
      asContentMessage(commandResultEnvelope("m-8", "req-9")),
      senderForTab(91)
    );

    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);
    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({
      type: "panel-init",
      tabId: 91
    } satisfies PanelInitMessage);

    const replayedBridgeMessages = panelPort.postedMessages.filter((message) => {
      if (typeof message !== "object" || message === null) {
        return false;
      }
      const typed = message as { type?: string };
      return typed.type === "panel-bridge-envelope";
    });

    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-connected",
      connected: false
    });
    expect(replayedBridgeMessages).toHaveLength(0);
  });

  it("broadcasts disconnected state after unregistering the last machine", async () => {
    const harness = await loadBackground();
    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);

    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({
      type: "panel-init",
      tabId: 92
    } satisfies PanelInitMessage);

    harness.emitRuntimeMessage(asContentMessage(registerEnvelope("m-connected")), senderForTab(92));
    harness.emitRuntimeMessage(
      asContentMessage(unregisterEnvelope("m-connected")),
      senderForTab(92)
    );

    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-connected",
      connected: true
    });
    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-connected",
      connected: false
    });
  });

  it("clears machine cache when tab reload starts", async () => {
    const harness = await loadBackground();
    const tabId = 95;

    harness.emitRuntimeMessage(asContentMessage(registerEnvelope("m-reload")), senderForTab(tabId));
    harness.emitTabUpdated(tabId, { status: "loading" }, { id: tabId } as chrome.tabs.Tab);

    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);
    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({
      type: "panel-init",
      tabId
    } satisfies PanelInitMessage);

    const replayedBridgeMessages = panelPort.postedMessages.filter((message) => {
      if (typeof message !== "object" || message === null) {
        return false;
      }
      return (message as { type?: string }).type === "panel-bridge-envelope";
    });

    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-connected",
      connected: false
    });
    expect(replayedBridgeMessages).toHaveLength(0);
  });

  it("re-injects content script on tab complete when panel is attached", async () => {
    const harness = await loadBackground();
    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);
    const tabId = 97;

    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({
      type: "panel-init",
      tabId
    } satisfies PanelInitMessage);
    harness.executeScript.mockClear();

    harness.emitTabUpdated(tabId, { status: "complete" }, { id: tabId } as chrome.tabs.Tab);

    expect(harness.executeScript).toHaveBeenCalledWith(
      {
        target: { tabId },
        files: ["src/content.ts"]
      },
      expect.any(Function)
    );
  });

  it("clears tab cache and ports when tab is removed", async () => {
    const harness = await loadBackground();
    const tabId = 96;
    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);

    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({
      type: "panel-init",
      tabId
    } satisfies PanelInitMessage);
    harness.emitRuntimeMessage(
      asContentMessage(registerEnvelope("m-removed")),
      senderForTab(tabId)
    );

    harness.emitTabRemoved(tabId);
    const before = panelPort.postedMessages.length;
    harness.emitRuntimeMessage(
      asContentMessage(snapshotEnvelope("m-removed", "review")),
      senderForTab(tabId)
    );

    expect(panelPort.postedMessages).toHaveLength(before);
  });

  it("evicts machine cache entries on unregister envelopes", async () => {
    const harness = await loadBackground();
    const machineId = "m-unregister";

    harness.emitRuntimeMessage(asContentMessage(registerEnvelope(machineId)), senderForTab(92));
    harness.emitRuntimeMessage(asContentMessage(unregisterEnvelope(machineId)), senderForTab(92));

    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);
    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({
      type: "panel-init",
      tabId: 92
    } satisfies PanelInitMessage);

    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-connected",
      connected: false
    });
    expect(
      panelPort.postedMessages.some((message) => {
        if (typeof message !== "object" || message === null) {
          return false;
        }
        return (message as { type?: string }).type === "panel-bridge-envelope";
      })
    ).toBe(false);
  });

  it("ignores malformed panel and runtime payloads", async () => {
    const harness = await loadBackground();
    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);
    harness.emitConnect(panelPort.port);

    panelPort.emitMessage({ type: "panel-init", tabId: 93 } satisfies PanelInitMessage);
    const before = panelPort.postedMessages.length;

    panelPort.emitMessage({ type: "panel-command", tabId: 93, envelope: { invalid: true } });
    harness.emitRuntimeMessage({ type: "unknown" }, senderForTab(93));

    expect(panelPort.postedMessages).toHaveLength(before);
    expect(harness.sendMessage).not.toHaveBeenCalled();
  });

  it("handles disconnect for ports that never initialized", async () => {
    const harness = await loadBackground();
    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);
    harness.emitConnect(panelPort.port);

    expect(() => panelPort.emitDisconnect()).not.toThrow();
  });
});
