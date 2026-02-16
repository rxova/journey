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
    window.postMessage(typedMessage.envelope, WINDOW_TARGET_ORIGIN);
  });
}
