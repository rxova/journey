import { isJourneyDevtoolsBridgeEnvelope } from "@rxova/journey-devtools-bridge";
import {
  isBackgroundToContentMessage,
  type BackgroundToContentMessage,
  type ContentToBackgroundMessage
} from "./shared";

const CONTENT_BRIDGE_FLAG = "__RXOVA_JOURNEY_DEVTOOLS_CONTENT_BRIDGE_INSTALLED__";
type WindowWithBridgeFlag = Window & {
  [CONTENT_BRIDGE_FLAG]?: boolean;
};
type CachedMachine = {
  register: Extract<ContentToBackgroundMessage["envelope"], { kind: "register" }> | null;
  snapshot: Extract<ContentToBackgroundMessage["envelope"], { kind: "snapshot" }> | null;
};

const resolveWindowTargetOrigin = (): string =>
  window.location.origin === "null" ? "*" : window.location.origin;

const isExpectedWindowOrigin = (origin: string): boolean => {
  if (origin.length === 0) {
    return false;
  }

  const expected = window.location.origin;
  if (expected === "null") {
    return origin === "null";
  }

  return origin === expected;
};

const WINDOW_TARGET_ORIGIN = resolveWindowTargetOrigin();
const maybeWindow = window as WindowWithBridgeFlag;
const machineCache = new Map<string, CachedMachine>();

const cacheEnvelope = (envelope: ContentToBackgroundMessage["envelope"]) => {
  if (envelope.kind === "commandResult" || envelope.kind === "commandError") {
    return;
  }

  const cachedMachine = machineCache.get(envelope.machineId) ?? { register: null, snapshot: null };

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
    machineCache.delete(envelope.machineId);
  } else {
    machineCache.set(envelope.machineId, cachedMachine);
  }
};

const replayCacheToBackground = () => {
  for (const cachedMachine of machineCache.values()) {
    if (cachedMachine.register) {
      chrome.runtime.sendMessage({
        type: "bridge-envelope",
        envelope: cachedMachine.register
      } satisfies ContentToBackgroundMessage);
    }
    if (cachedMachine.snapshot) {
      chrome.runtime.sendMessage({
        type: "bridge-envelope",
        envelope: cachedMachine.snapshot
      } satisfies ContentToBackgroundMessage);
    }
  }
};

if (!maybeWindow[CONTENT_BRIDGE_FLAG]) {
  maybeWindow[CONTENT_BRIDGE_FLAG] = true;

  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (
      event.source !== window ||
      !isExpectedWindowOrigin(event.origin) ||
      !isJourneyDevtoolsBridgeEnvelope(event.data)
    ) {
      return;
    }

    cacheEnvelope(event.data);

    const message: ContentToBackgroundMessage = {
      type: "bridge-envelope",
      envelope: event.data
    };

    chrome.runtime.sendMessage(message);
  });

  chrome.runtime.onMessage.addListener((message: unknown) => {
    if (!isBackgroundToContentMessage(message)) {
      return;
    }

    const typedMessage: BackgroundToContentMessage = message;
    if (typedMessage.type === "bridge-replay-request") {
      replayCacheToBackground();
      return;
    }

    window.postMessage(typedMessage.envelope, WINDOW_TARGET_ORIGIN);
  });
}
