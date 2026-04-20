import {
  JOURNEY_DEVTOOLS_REPLAY_REQUEST,
  isJourneyDevtoolsBridgeEnvelope
} from "@rxova/journey-devtools-bridge";
import {
  isBackgroundToContentMessage,
  type BackgroundToContentMessage,
  type ContentToBackgroundMessage
} from "./shared";

const CONTENT_BRIDGE_FLAG = "__RXOVA_JOURNEY_DEVTOOLS_CONTENT_BRIDGE_INSTALLED__";
type WindowWithBridgeFlag = Window & {
  [CONTENT_BRIDGE_FLAG]?: boolean;
};
type CachedJourneyMachine = {
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
const journeyMachineCache = new Map<string, CachedJourneyMachine>();

const requestBridgeReplayFromPage = () => {
  window.postMessage(
    {
      type: JOURNEY_DEVTOOLS_REPLAY_REQUEST
    },
    WINDOW_TARGET_ORIGIN
  );
};

const cacheEnvelope = (envelope: ContentToBackgroundMessage["envelope"]) => {
  if (
    envelope.kind === "operationResult" ||
    envelope.kind === "operationError" ||
    envelope.kind === "observation"
  ) {
    return;
  }

  const cachedJourneyMachine = journeyMachineCache.get(envelope.machineId) ?? {
    register: null,
    snapshot: null
  };

  if (envelope.kind === "register") {
    cachedJourneyMachine.register = envelope;
    cachedJourneyMachine.snapshot = {
      ...envelope,
      kind: "snapshot"
    };
  }

  if (envelope.kind === "snapshot") {
    cachedJourneyMachine.snapshot = envelope;
  }

  if (envelope.kind === "unregister") {
    journeyMachineCache.delete(envelope.machineId);
  } else {
    journeyMachineCache.set(envelope.machineId, cachedJourneyMachine);
  }
};

const replayCacheToBackground = () => {
  for (const cachedJourneyMachine of journeyMachineCache.values()) {
    if (cachedJourneyMachine.register) {
      chrome.runtime.sendMessage({
        type: "bridge-envelope",
        envelope: cachedJourneyMachine.register
      } satisfies ContentToBackgroundMessage);
    }
    // Cached machines are only retained after register/snapshot envelopes, both of which seed snapshot state.
    chrome.runtime.sendMessage({
      type: "bridge-envelope",
      envelope: cachedJourneyMachine.snapshot!
    } satisfies ContentToBackgroundMessage);
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
      requestBridgeReplayFromPage();
      replayCacheToBackground();
      return;
    }

    window.postMessage(typedMessage.envelope, WINDOW_TARGET_ORIGIN);
  });

  requestBridgeReplayFromPage();
}
