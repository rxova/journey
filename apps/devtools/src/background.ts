import type {
  JourneyDevtoolsBridgeEnvelope,
  JourneyDevtoolsBridgeRegisterEnvelope,
  JourneyDevtoolsBridgeSnapshotEnvelope
} from "@rxova/journey-devtools-bridge";
import {
  JOURNEY_DEVTOOLS_PANEL_PORT,
  createTransportErrorEnvelope,
  isContentToBackgroundMessage,
  isPanelToBackgroundMessage,
  serializeTransportError,
  type BackgroundToContentMessage,
  type BackgroundToPanelMessage,
  type PanelWarning
} from "./shared";

type CachedMachine = {
  register: JourneyDevtoolsBridgeRegisterEnvelope | null;
  snapshot: JourneyDevtoolsBridgeSnapshotEnvelope | null;
};

const portTabMap = new Map<chrome.runtime.Port, number>();
const portsByTab = new Map<number, Set<chrome.runtime.Port>>();
const machineCacheByTab = new Map<number, Map<string, CachedMachine>>();
const warningByTab = new Map<number, PanelWarning | null>();
const CONTENT_SCRIPT_FILE = chrome.runtime.getManifest().content_scripts?.[0]?.js?.[0] ?? null;

const isTabConnected = (tabId: number): boolean => (machineCacheByTab.get(tabId)?.size ?? 0) > 0;
const hasPanelPorts = (tabId: number): boolean => (portsByTab.get(tabId)?.size ?? 0) > 0;

const getRuntimeErrorMessage = (error: unknown): string | null => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : null;
  }

  return null;
};

const isIgnorableSendMessageError = (error: unknown): boolean => {
  const message = getRuntimeErrorMessage(error);
  if (!message) {
    return false;
  }

  // Fire-and-forget message listeners commonly trigger this even when
  // message delivery worked, because no response callback is used.
  return message.includes("The message port closed before a response was received.");
};

const removePanelPort = (port: chrome.runtime.Port) => {
  const tabId = portTabMap.get(port);
  if (tabId === undefined) {
    return;
  }

  const tabPorts = portsByTab.get(tabId);
  if (tabPorts) {
    tabPorts.delete(port);
    if (tabPorts.size === 0) {
      portsByTab.delete(tabId);
    }
  }
  portTabMap.delete(port);
};

const broadcastPanelWarning = (tabId: number, warning: Omit<PanelWarning, "tabId"> | null) => {
  const warningPayload = warning ? { ...warning, tabId } : null;
  warningByTab.set(tabId, warningPayload);
  broadcastToPanel(tabId, {
    type: "panel-warning",
    warning: warningPayload
  });
};

const injectContentScript = (tabId: number) => {
  if (!CONTENT_SCRIPT_FILE) {
    broadcastPanelWarning(tabId, {
      code: "injection-missing-entry",
      message: "Content bridge entry is missing from extension manifest.",
      recoverable: false
    });
    return;
  }

  if (!chrome.scripting?.executeScript) {
    broadcastPanelWarning(tabId, {
      code: "injection-unavailable",
      message: "Content script injection is unavailable in this browser context.",
      recoverable: false
    });
    return;
  }

  chrome.scripting.executeScript(
    {
      target: {
        tabId
      },
      files: [CONTENT_SCRIPT_FILE]
    },
    () => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        const serialized = serializeTransportError(runtimeError);
        broadcastPanelWarning(tabId, {
          code: "injection-failed",
          message: `Content script injection failed: ${serialized.message}`,
          recoverable: true
        });
        return;
      }

      broadcastPanelWarning(tabId, null);
      const replayRequest: BackgroundToContentMessage = {
        type: "bridge-replay-request"
      };
      chrome.tabs.sendMessage(tabId, replayRequest, () => {
        // Accessing lastError prevents unchecked runtime error noise when a receiver is unavailable.
        void chrome.runtime.lastError;
      });
    }
  );
};

const broadcastToPanel = (tabId: number, message: BackgroundToPanelMessage) => {
  const tabPorts = portsByTab.get(tabId);
  if (!tabPorts) {
    return;
  }

  const stalePorts: chrome.runtime.Port[] = [];
  for (const port of tabPorts) {
    try {
      port.postMessage(message);
    } catch {
      stalePorts.push(port);
    }
  }

  for (const stalePort of stalePorts) {
    removePanelPort(stalePort);
  }
};

const cacheEnvelope = (tabId: number, envelope: JourneyDevtoolsBridgeEnvelope) => {
  if (envelope.kind === "commandResult" || envelope.kind === "commandError") {
    return;
  }

  const tabCache = machineCacheByTab.get(tabId) ?? new Map<string, CachedMachine>();
  const cachedMachine = tabCache.get(envelope.machineId) ?? { register: null, snapshot: null };

  if (envelope.kind === "register") {
    cachedMachine.register = envelope;
    cachedMachine.snapshot = {
      ...envelope,
      kind: "snapshot"
    };
  }

  if (envelope.kind === "snapshot") {
    cachedMachine.snapshot = envelope;
  }

  if (envelope.kind === "unregister") {
    tabCache.delete(envelope.machineId);
  } else {
    tabCache.set(envelope.machineId, cachedMachine);
  }

  machineCacheByTab.set(tabId, tabCache);
};

const clearTabMachineCache = (tabId: number) => {
  machineCacheByTab.delete(tabId);
  warningByTab.delete(tabId);
  broadcastToPanel(tabId, {
    type: "panel-connected",
    connected: false
  });
};

const clearTabPortState = (tabId: number) => {
  const tabPorts = portsByTab.get(tabId);
  if (tabPorts) {
    for (const port of tabPorts) {
      portTabMap.delete(port);
    }
  }
  portsByTab.delete(tabId);

  for (const [port, mappedTabId] of portTabMap.entries()) {
    if (mappedTabId === tabId) {
      portTabMap.delete(port);
    }
  }
};

const replayCacheToPanel = (tabId: number, port: chrome.runtime.Port) => {
  const tabCache = machineCacheByTab.get(tabId);
  if (!tabCache) {
    return;
  }

  for (const cachedMachine of tabCache.values()) {
    if (cachedMachine.register) {
      port.postMessage({ type: "panel-bridge-envelope", envelope: cachedMachine.register });
    }
    // Cached machines are only retained after register/snapshot envelopes, both of which seed snapshot state.
    port.postMessage({ type: "panel-bridge-envelope", envelope: cachedMachine.snapshot! });
  }
};

const registerPanelPort = (port: chrome.runtime.Port, tabId: number) => {
  portTabMap.set(port, tabId);

  const tabPorts = portsByTab.get(tabId) ?? new Set<chrome.runtime.Port>();
  tabPorts.add(port);
  portsByTab.set(tabId, tabPorts);

  const connected = isTabConnected(tabId);
  port.postMessage({ type: "panel-connected", connected } satisfies BackgroundToPanelMessage);
  port.postMessage({
    type: "panel-warning",
    warning: warningByTab.get(tabId) ?? null
  } satisfies BackgroundToPanelMessage);
  replayCacheToPanel(tabId, port);
  injectContentScript(tabId);
};

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== JOURNEY_DEVTOOLS_PANEL_PORT) {
    return;
  }

  port.onMessage.addListener((message: unknown) => {
    if (!isPanelToBackgroundMessage(message)) {
      return;
    }

    if (message.type === "panel-init") {
      registerPanelPort(port, message.tabId);
      return;
    }

    const outboundMessage: BackgroundToContentMessage = {
      type: "extension-envelope",
      envelope: message.envelope
    };

    chrome.tabs.sendMessage(message.tabId, outboundMessage, () => {
      const runtimeError = chrome.runtime.lastError;
      if (!runtimeError || isIgnorableSendMessageError(runtimeError)) {
        return;
      }

      const errorEnvelope = createTransportErrorEnvelope(
        message.envelope.machineId,
        message.envelope.requestId,
        serializeTransportError(runtimeError)
      );
      broadcastToPanel(message.tabId, {
        type: "panel-bridge-envelope",
        envelope: errorEnvelope
      });
    });
  });

  port.onDisconnect.addListener(() => {
    removePanelPort(port);
  });
});

chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  if (!isContentToBackgroundMessage(message)) {
    return;
  }

  const tabId = sender.tab?.id;
  if (tabId === undefined) {
    return;
  }

  cacheEnvelope(tabId, message.envelope);
  const connected = isTabConnected(tabId);
  broadcastToPanel(tabId, {
    type: "panel-connected",
    connected
  });
  broadcastToPanel(tabId, {
    type: "panel-bridge-envelope",
    envelope: message.envelope
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    clearTabMachineCache(tabId);
    return;
  }

  if (changeInfo.status === "complete" && hasPanelPorts(tabId)) {
    injectContentScript(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabMachineCache(tabId);
  clearTabPortState(tabId);
  warningByTab.delete(tabId);
});
