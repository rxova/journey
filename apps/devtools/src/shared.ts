import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  isJourneyDevtoolsBridgeEnvelope,
  isJourneyDevtoolsExtensionEnvelope,
  type JourneyDevtoolsBridgeCommandErrorEnvelope,
  type JourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsCommand,
  type JourneyDevtoolsExtensionEnvelope,
  type JourneyDevtoolsSerializedError
} from "@rxova/journey-devtools-bridge";

export const JOURNEY_DEVTOOLS_PANEL_PORT = "rxova-journey-devtools-panel";

export type ContentToBackgroundMessage = {
  type: "bridge-envelope";
  envelope: JourneyDevtoolsBridgeEnvelope;
};

export type BackgroundToContentMessage = {
  type: "extension-envelope";
  envelope: JourneyDevtoolsExtensionEnvelope;
};

export type PanelInitMessage = {
  type: "panel-init";
  tabId: number;
};

export type PanelCommandMessage = {
  type: "panel-command";
  tabId: number;
  envelope: JourneyDevtoolsExtensionEnvelope;
};

export type PanelToBackgroundMessage = PanelInitMessage | PanelCommandMessage;

export type PanelWarningCode =
  | "injection-missing-entry"
  | "injection-unavailable"
  | "injection-failed";

export type PanelWarning = {
  code: PanelWarningCode;
  message: string;
  recoverable?: boolean;
  tabId: number;
};

export type BackgroundToPanelMessage =
  | {
      type: "panel-connected";
      connected: boolean;
    }
  | {
      type: "panel-warning";
      warning: PanelWarning | null;
    }
  | {
      type: "panel-bridge-envelope";
      envelope: JourneyDevtoolsBridgeEnvelope;
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isPanelWarningCode = (value: unknown): value is PanelWarningCode =>
  value === "injection-missing-entry" ||
  value === "injection-unavailable" ||
  value === "injection-failed";

const isPanelWarning = (value: unknown): value is PanelWarning => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isPanelWarningCode(value.code) &&
    typeof value.message === "string" &&
    typeof value.tabId === "number" &&
    (value.recoverable === undefined || typeof value.recoverable === "boolean")
  );
};

export const isContentToBackgroundMessage = (
  value: unknown
): value is ContentToBackgroundMessage => {
  if (!isRecord(value) || value.type !== "bridge-envelope") {
    return false;
  }
  return isJourneyDevtoolsBridgeEnvelope(value.envelope);
};

export const isBackgroundToContentMessage = (
  value: unknown
): value is BackgroundToContentMessage => {
  if (!isRecord(value) || value.type !== "extension-envelope") {
    return false;
  }
  return isJourneyDevtoolsExtensionEnvelope(value.envelope);
};

export const isPanelToBackgroundMessage = (value: unknown): value is PanelToBackgroundMessage => {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (value.type === "panel-init") {
    return typeof value.tabId === "number";
  }

  if (value.type === "panel-command") {
    return typeof value.tabId === "number" && isJourneyDevtoolsExtensionEnvelope(value.envelope);
  }

  return false;
};

export const isBackgroundToPanelMessage = (value: unknown): value is BackgroundToPanelMessage => {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (value.type === "panel-connected") {
    return typeof value.connected === "boolean";
  }

  if (value.type === "panel-warning") {
    return value.warning === null || isPanelWarning(value.warning);
  }

  if (value.type === "panel-bridge-envelope") {
    return isJourneyDevtoolsBridgeEnvelope(value.envelope);
  }

  return false;
};

export const createCommandEnvelope = (
  machineId: string,
  requestId: string,
  command: JourneyDevtoolsCommand
): JourneyDevtoolsExtensionEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: "rxova-journey-extension",
  kind: "command",
  machineId,
  requestId,
  command,
  timestamp: Date.now()
});

export const createTransportErrorEnvelope = (
  machineId: string,
  requestId: string,
  error: JourneyDevtoolsSerializedError
): JourneyDevtoolsBridgeCommandErrorEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "commandError",
  machineId,
  requestId,
  error,
  timestamp: Date.now()
});

export const serializeTransportError = (error: unknown): JourneyDevtoolsSerializedError => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: typeof error.stack === "string" ? error.stack : null,
      cause: null
    };
  }

  return {
    name: null,
    message: typeof error === "string" ? error : "Unknown transport error",
    stack: null,
    cause: null
  };
};
