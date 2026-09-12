import { afterEach, describe, expect, it, vi } from "vitest";

import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION
} from "@rxova/journey-devtools-bridge";
import { JOURNEY_DEVTOOLS_PANEL_PORT, type ContentToBackgroundMessage } from "../src/shared";

type Listener<TArgs extends unknown[]> = (...args: TArgs) => void;

type ListenerSet<TArgs extends unknown[]> = {
  addListener: (listener: Listener<TArgs>) => void;
  removeListener: (listener: Listener<TArgs>) => void;
  emit: (...args: TArgs) => void;
};

const createListenerSet = <TArgs extends unknown[]>(): ListenerSet<TArgs> => {
  const listeners = new Set<Listener<TArgs>>();

  return {
    addListener: (listener) => {
      listeners.add(listener);
    },
    removeListener: (listener) => {
      listeners.delete(listener);
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

const createPortHarness = (
  name: string,
  options: { throwOnPostMessage?: boolean } = {}
): PortHarness => {
  const onMessage = createListenerSet<[unknown]>();
  const onDisconnect = createListenerSet<[]>();
  const postedMessages: unknown[] = [];

  const port = {
    name,
    postMessage: (message: unknown) => {
      if (options.throwOnPostMessage) {
        throw new Error("Port disconnected");
      }
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
    emitMessage: (message) => onMessage.emit(message),
    emitDisconnect: () => onDisconnect.emit()
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
    changeInfo: chrome.tabs.OnUpdatedInfo,
    tab?: chrome.tabs.Tab
  ) => void;
  setSendMessageImpl: (impl: SendMessageImpl) => void;
  setRuntimeLastError: (error: Error | undefined) => void;
  sendMessage: ReturnType<typeof vi.fn>;
  executeScript: ReturnType<typeof vi.fn> | null;
};

const createChromeHarness = (options?: {
  contentScriptFile?: string | null;
  includeScripting?: boolean;
}): ChromeHarness => {
  const onConnect = createListenerSet<[chrome.runtime.Port]>();
  const onRuntimeMessage = createListenerSet<[unknown, chrome.runtime.MessageSender]>();
  const onTabRemoved = createListenerSet<[number, chrome.tabs.OnRemovedInfo]>();
  const onTabUpdated = createListenerSet<[number, chrome.tabs.OnUpdatedInfo, chrome.tabs.Tab]>();
  const runtimeState: { lastError: Error | undefined } = { lastError: undefined };

  let sendMessageImpl: SendMessageImpl = (_tabId, _message, callback) => {
    runtimeState.lastError = undefined;
    callback?.();
  };

  const sendMessage = vi.fn((tabId: number, message: unknown, callback?: () => void) => {
    sendMessageImpl(tabId, message, callback);
  });
  const executeScript = vi.fn(
    (_injection: unknown, callback?: (injectionResults?: unknown[]) => void) => {
      runtimeState.lastError = undefined;
      callback?.([]);
    }
  );
  const contentScriptFile =
    options && "contentScriptFile" in options ? options.contentScriptFile : "src/content.ts";
  const includeScripting = options?.includeScripting ?? true;

  const chromeMock = {
    runtime: {
      getManifest: () =>
        ({
          content_scripts: contentScriptFile ? [{ js: [contentScriptFile] }] : []
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
    ...(includeScripting
      ? {
          scripting: {
            executeScript
          }
        }
      : {})
  } as unknown as typeof chrome;

  return {
    chromeMock,
    emitConnect: (port) => onConnect.emit(port),
    emitRuntimeMessage: (message, sender) => onRuntimeMessage.emit(message, sender),
    emitTabRemoved: (tabId) => onTabRemoved.emit(tabId, { isWindowClosing: false, windowId: 1 }),
    emitTabUpdated: (tabId, changeInfo, tab = { id: tabId } as chrome.tabs.Tab) =>
      onTabUpdated.emit(tabId, changeInfo, tab),
    setSendMessageImpl: (impl) => {
      sendMessageImpl = impl;
    },
    setRuntimeLastError: (error) => {
      runtimeState.lastError = error;
    },
    sendMessage,
    executeScript: includeScripting ? executeScript : null
  };
};

const createRegisterEnvelope = (machineId: string) =>
  ({
    channel: JOURNEY_DEVTOOLS_CHANNEL,
    version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
    source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
    kind: "register",
    machineId,
    timestamp: Date.now(),
    meta: {
      machineId,
      label: "Checkout",
      appName: "Storefront",
      mutationsEnabled: true,
      mode: "graph",
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
            }
          ]
        }
      ]
    },
    snapshot: {
      currentStepId: "start",
      history: { timeline: ["start"], index: 0 },
      context: { count: 0 },
      visited: { start: true },
      status: "running",
      async: { isLoading: false, byStep: {} }
    }
  }) as const;

const createSnapshotEnvelope = (machineId: string, currentStepId: string) =>
  ({
    channel: JOURNEY_DEVTOOLS_CHANNEL,
    version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
    source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
    kind: "snapshot",
    machineId,
    timestamp: Date.now(),
    snapshot: {
      currentStepId,
      history: { timeline: ["start", currentStepId], index: 1 },
      context: { count: 1 },
      visited: { start: true, [currentStepId]: true },
      status: "running",
      async: { isLoading: false, byStep: {} }
    }
  }) as const;

const asContentMessage = (envelope: unknown): ContentToBackgroundMessage => ({
  type: "bridge-envelope",
  envelope: envelope as ContentToBackgroundMessage["envelope"]
});

const senderForTab = (tabId: number): chrome.runtime.MessageSender =>
  ({ tab: { id: tabId } }) as chrome.runtime.MessageSender;

const loadBackground = async (options?: {
  contentScriptFile?: string | null;
  includeScripting?: boolean;
}) => {
  const harness = createChromeHarness(options);
  vi.stubGlobal("chrome", harness.chromeMock);
  await import("../src/background");
  return harness;
};

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("background transport", () => {
  it("ignores non-panel ports and malformed panel messages", async () => {
    const harness = await loadBackground();
    const otherPort = createPortHarness("other-port");
    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);

    harness.emitConnect(otherPort.port);
    otherPort.emitMessage({ type: "panel-init", tabId: 99 });
    otherPort.emitMessage({ type: "bad-message" });
    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({ type: "bad-message" });

    expect(otherPort.postedMessages).toHaveLength(0);
    expect(panelPort.postedMessages).toHaveLength(0);
  });

  it("registers panel ports and injects the content bridge when no cache exists", async () => {
    const harness = await loadBackground();
    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);

    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({ type: "panel-init", tabId: 15 });

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
    expect(harness.sendMessage).toHaveBeenCalledWith(
      15,
      { type: "bridge-replay-request" },
      expect.any(Function)
    );
  });

  it("broadcasts injection warnings when entry is missing or scripting is unavailable", async () => {
    const missingEntry = await loadBackground({ contentScriptFile: null });
    const missingPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);

    missingEntry.emitConnect(missingPort.port);
    missingPort.emitMessage({ type: "panel-init", tabId: 12 });

    expect(missingPort.postedMessages).toContainEqual({
      type: "panel-warning",
      warning: {
        code: "injection-missing-entry",
        message: "Content bridge entry is missing from extension manifest.",
        recoverable: false,
        tabId: 12
      }
    });

    vi.resetModules();

    const unavailable = await loadBackground({ includeScripting: false });
    const unavailablePort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);

    unavailable.emitConnect(unavailablePort.port);
    unavailablePort.emitMessage({ type: "panel-init", tabId: 13 });

    expect(unavailablePort.postedMessages).toContainEqual({
      type: "panel-warning",
      warning: {
        code: "injection-unavailable",
        message: "Content script injection is unavailable in this browser context.",
        recoverable: false,
        tabId: 13
      }
    });
  });

  it("broadcasts recoverable injection failures from executeScript runtime errors", async () => {
    const harness = await loadBackground();
    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);

    harness.emitConnect(panelPort.port);
    if (harness.executeScript) {
      harness.executeScript.mockImplementationOnce((_injection, callback) => {
        harness.setRuntimeLastError(new Error("Cannot access contents of the page"));
        callback?.([]);
        harness.setRuntimeLastError(undefined);
      });
    }

    panelPort.emitMessage({ type: "panel-init", tabId: 18 });

    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-warning",
      warning: {
        code: "injection-failed",
        message: "Content script injection failed: Cannot access contents of the page",
        recoverable: true,
        tabId: 18
      }
    });
  });

  it("normalizes non-Error injection failure shapes", async () => {
    const stringError = await loadBackground();
    const stringPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);
    stringError.emitConnect(stringPort.port);
    if (stringError.executeScript) {
      stringError.executeScript.mockImplementationOnce((_injection, callback) => {
        stringError.setRuntimeLastError("plain failure" as never);
        callback?.([]);
        stringError.setRuntimeLastError(undefined);
      });
    }
    stringPort.emitMessage({ type: "panel-init", tabId: 19 });
    expect(stringPort.postedMessages).toContainEqual({
      type: "panel-warning",
      warning: expect.objectContaining({
        message: "Content script injection failed: plain failure",
        tabId: 19
      })
    });

    vi.resetModules();

    const objectError = await loadBackground();
    const objectPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);
    objectError.emitConnect(objectPort.port);
    if (objectError.executeScript) {
      objectError.executeScript.mockImplementationOnce((_injection, callback) => {
        objectError.setRuntimeLastError({ message: "object failure" } as never);
        callback?.([]);
        objectError.setRuntimeLastError(undefined);
      });
    }
    objectPort.emitMessage({ type: "panel-init", tabId: 20 });
    expect(objectPort.postedMessages).toContainEqual({
      type: "panel-warning",
      warning: expect.objectContaining({
        message: "Content script injection failed: object failure",
        tabId: 20
      })
    });

    vi.resetModules();

    const unknownError = await loadBackground();
    const unknownPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);
    unknownError.emitConnect(unknownPort.port);
    if (unknownError.executeScript) {
      unknownError.executeScript.mockImplementationOnce((_injection, callback) => {
        unknownError.setRuntimeLastError({ message: 42 } as never);
        callback?.([]);
        unknownError.setRuntimeLastError(undefined);
      });
    }
    unknownPort.emitMessage({ type: "panel-init", tabId: 23 });
    expect(unknownPort.postedMessages).toContainEqual({
      type: "panel-warning",
      warning: expect.objectContaining({
        code: "injection-failed",
        message: "Content script injection failed: Unknown transport error",
        tabId: 23
      })
    });
  });

  it("replays cached register and snapshot envelopes to late panel connections", async () => {
    const harness = await loadBackground();
    harness.emitRuntimeMessage(asContentMessage(createRegisterEnvelope("m1")), senderForTab(21));
    harness.emitRuntimeMessage(
      asContentMessage(createSnapshotEnvelope("m1", "review")),
      senderForTab(21)
    );

    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);
    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({ type: "panel-init", tabId: 21 });

    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-connected",
      connected: true
    });
    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-warning",
      warning: null
    });
    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-bridge-envelope",
      envelope: expect.objectContaining({ kind: "register", machineId: "m1" })
    });
    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-bridge-envelope",
      envelope: expect.objectContaining({ kind: "snapshot", machineId: "m1" })
    });
    expect(harness.executeScript).not.toHaveBeenCalled();
  });

  it("replays snapshot-only cache entries", async () => {
    const harness = await loadBackground();
    harness.emitRuntimeMessage(
      asContentMessage(createSnapshotEnvelope("m1", "review")),
      senderForTab(25)
    );

    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);
    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({ type: "panel-init", tabId: 25 });

    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-connected",
      connected: true
    });
    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-bridge-envelope",
      envelope: expect.objectContaining({ kind: "snapshot", machineId: "m1" })
    });
  });

  it("replays the last warning to late panel connections", async () => {
    const harness = await loadBackground({ contentScriptFile: null });
    const firstPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);
    harness.emitConnect(firstPort.port);
    firstPort.emitMessage({ type: "panel-init", tabId: 24 });

    const secondPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);
    harness.emitConnect(secondPort.port);
    secondPort.emitMessage({ type: "panel-init", tabId: 24 });

    expect(secondPort.postedMessages).toContainEqual({
      type: "panel-warning",
      warning: {
        code: "injection-missing-entry",
        message: "Content bridge entry is missing from extension manifest.",
        recoverable: false,
        tabId: 24
      }
    });
  });

  it("forwards invoke envelopes to tabs and reports transport failures back to the panel", async () => {
    const harness = await loadBackground();
    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);
    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({ type: "panel-init", tabId: 22 });
    panelPort.postedMessages.length = 0;

    harness.setSendMessageImpl((_tabId, _message, callback) => {
      harness.setRuntimeLastError(new Error("Receiving end does not exist."));
      callback?.();
      harness.setRuntimeLastError(undefined);
    });

    panelPort.emitMessage({
      type: "panel-command",
      tabId: 22,
      envelope: {
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: "rxova-journey-extension",
        kind: "invoke",
        machineId: "m1",
        requestId: "req-1",
        invocation: { operationId: "core.goToNextStep" },
        timestamp: Date.now()
      }
    });

    expect(harness.sendMessage).toHaveBeenCalledWith(
      22,
      {
        type: "extension-envelope",
        envelope: expect.objectContaining({
          kind: "invoke",
          requestId: "req-1"
        })
      },
      expect.any(Function)
    );
    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-bridge-envelope",
      envelope: expect.objectContaining({
        kind: "operationError",
        operationId: "transport",
        requestId: "req-1",
        machineId: "m1"
      })
    });

    panelPort.postedMessages.length = 0;
    harness.setSendMessageImpl((_tabId, _message, callback) => {
      harness.setRuntimeLastError(
        new Error("The message port closed before a response was received.")
      );
      callback?.();
      harness.setRuntimeLastError(undefined);
    });
    panelPort.emitMessage({
      type: "panel-command",
      tabId: 22,
      envelope: {
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: "rxova-journey-extension",
        kind: "invoke",
        machineId: "m1",
        requestId: "req-2",
        invocation: { operationId: "core.goToNextStep" },
        timestamp: Date.now()
      }
    });
    expect(panelPort.postedMessages).toHaveLength(0);

    harness.setSendMessageImpl((_tabId, _message, callback) => {
      harness.setRuntimeLastError({ message: 42 } as never);
      callback?.();
      harness.setRuntimeLastError(undefined);
    });
    panelPort.emitMessage({
      type: "panel-command",
      tabId: 22,
      envelope: {
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: "rxova-journey-extension",
        kind: "invoke",
        machineId: "m1",
        requestId: "req-3",
        invocation: { operationId: "core.goToNextStep" },
        timestamp: Date.now()
      }
    });
    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-bridge-envelope",
      envelope: expect.objectContaining({
        kind: "operationError",
        requestId: "req-3"
      })
    });

    panelPort.postedMessages.length = 0;
    harness.setSendMessageImpl((_tabId, _message, callback) => {
      harness.setRuntimeLastError("plain send failure" as never);
      callback?.();
      harness.setRuntimeLastError(undefined);
    });
    panelPort.emitMessage({
      type: "panel-command",
      tabId: 22,
      envelope: {
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: "rxova-journey-extension",
        kind: "invoke",
        machineId: "m1",
        requestId: "req-4",
        invocation: { operationId: "core.goToNextStep" },
        timestamp: Date.now()
      }
    });
    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-bridge-envelope",
      envelope: expect.objectContaining({
        kind: "operationError",
        requestId: "req-4"
      })
    });

    panelPort.postedMessages.length = 0;
    harness.setSendMessageImpl((_tabId, _message, callback) => {
      harness.setRuntimeLastError(null as never);
      callback?.();
      harness.setRuntimeLastError(undefined);
    });
    panelPort.emitMessage({
      type: "panel-command",
      tabId: 22,
      envelope: {
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: "rxova-journey-extension",
        kind: "invoke",
        machineId: "m1",
        requestId: "req-5",
        invocation: { operationId: "core.goToNextStep" },
        timestamp: Date.now()
      }
    });
    expect(panelPort.postedMessages).toHaveLength(0);
  });

  it("broadcasts incoming bridge envelopes and clears cache on reload and removal", async () => {
    const harness = await loadBackground();
    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);
    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({ type: "panel-init", tabId: 30 });
    panelPort.postedMessages.length = 0;

    harness.emitRuntimeMessage(asContentMessage(createRegisterEnvelope("m1")), senderForTab(30));
    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-connected",
      connected: true
    });
    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-bridge-envelope",
      envelope: expect.objectContaining({ kind: "register", machineId: "m1" })
    });

    harness.emitTabUpdated(30, { status: "loading" });
    expect(panelPort.postedMessages).toContainEqual({
      type: "panel-connected",
      connected: false
    });

    panelPort.postedMessages.length = 0;
    harness.emitTabUpdated(30, { status: "complete" });
    expect(harness.executeScript).toHaveBeenCalledWith(
      {
        target: { tabId: 30 },
        files: ["src/content.ts"]
      },
      expect.any(Function)
    );

    harness.emitTabRemoved(30);
    panelPort.postedMessages.length = 0;
    harness.emitRuntimeMessage(
      asContentMessage(createSnapshotEnvelope("m1", "done")),
      senderForTab(30)
    );
    expect(panelPort.postedMessages).toHaveLength(0);
  });

  it("does not cache operation outcomes and evicts machines on unregister", async () => {
    const harness = await loadBackground();
    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);
    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({ type: "panel-init", tabId: 35 });
    panelPort.postedMessages.length = 0;

    harness.emitRuntimeMessage(asContentMessage(createRegisterEnvelope("m1")), senderForTab(35));
    harness.emitRuntimeMessage(
      asContentMessage({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "operationResult",
        machineId: "m1",
        requestId: "req-1",
        operationId: "core.goToNextStep",
        result: {
          kind: "snapshot",
          snapshot: createRegisterEnvelope("m1").snapshot,
          transitioned: true
        },
        timestamp: Date.now()
      }),
      senderForTab(35)
    );
    harness.emitRuntimeMessage(
      asContentMessage({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "unregister",
        machineId: "m1",
        timestamp: Date.now()
      }),
      senderForTab(35)
    );

    const latePanel = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);
    harness.emitConnect(latePanel.port);
    latePanel.emitMessage({ type: "panel-init", tabId: 35 });

    expect(latePanel.postedMessages).toContainEqual({
      type: "panel-connected",
      connected: false
    });
  });

  it("drops stale panel ports when postMessage throws", async () => {
    const harness = await loadBackground();
    const stalePort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);
    const healthyPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);

    harness.emitConnect(stalePort.port);
    stalePort.emitMessage({ type: "panel-init", tabId: 40 });
    harness.emitConnect(healthyPort.port);
    healthyPort.emitMessage({ type: "panel-init", tabId: 40 });
    healthyPort.postedMessages.length = 0;
    (stalePort.port as unknown as { postMessage: (message: unknown) => void }).postMessage = () => {
      throw new Error("Port disconnected");
    };

    harness.emitRuntimeMessage(asContentMessage(createRegisterEnvelope("m1")), senderForTab(40));
    expect(healthyPort.postedMessages).toContainEqual({
      type: "panel-bridge-envelope",
      envelope: expect.objectContaining({ kind: "register", machineId: "m1" })
    });

    healthyPort.postedMessages.length = 0;
    stalePort.emitDisconnect();
    harness.emitRuntimeMessage(
      asContentMessage(createSnapshotEnvelope("m1", "review")),
      senderForTab(40)
    );
    expect(healthyPort.postedMessages).toContainEqual({
      type: "panel-bridge-envelope",
      envelope: expect.objectContaining({ kind: "snapshot", machineId: "m1" })
    });
  });

  it("cleans up the final panel port on disconnect", async () => {
    const harness = await loadBackground();
    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);

    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({ type: "panel-init", tabId: 45 });
    panelPort.postedMessages.length = 0;
    panelPort.emitDisconnect();

    harness.emitRuntimeMessage(asContentMessage(createRegisterEnvelope("m1")), senderForTab(45));
    expect(panelPort.postedMessages).toHaveLength(0);
  });

  it("ignores malformed content messages and senderless bridge envelopes", async () => {
    const harness = await loadBackground();
    const panelPort = createPortHarness(JOURNEY_DEVTOOLS_PANEL_PORT);
    harness.emitConnect(panelPort.port);
    panelPort.emitMessage({ type: "panel-init", tabId: 50 });
    panelPort.postedMessages.length = 0;

    harness.emitRuntimeMessage({ type: "invalid" }, senderForTab(50));
    harness.emitRuntimeMessage(asContentMessage(createRegisterEnvelope("m1")), {});

    expect(panelPort.postedMessages).toHaveLength(0);
  });

  it("ignores tab update complete events when no panel ports are attached", async () => {
    const harness = await loadBackground();
    harness.emitTabUpdated(88, { status: "complete" });
    expect(harness.executeScript).not.toHaveBeenCalled();
  });
});
