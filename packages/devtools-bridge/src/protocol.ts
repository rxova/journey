import type { JourneySnapshot, JourneyStepAsyncState } from "@rxova/journey-core";

export const JOURNEY_DEVTOOLS_PROTOCOL_VERSION = 3 as const;
export const JOURNEY_DEVTOOLS_CHANNEL = "__RXOVA_JOURNEY_DEVTOOLS__" as const;

export const JOURNEY_DEVTOOLS_BRIDGE_SOURCE = "rxova-journey-bridge" as const;
export const JOURNEY_DEVTOOLS_EXTENSION_SOURCE = "rxova-journey-extension" as const;

export type JourneyDevtoolsSource =
  | typeof JOURNEY_DEVTOOLS_BRIDGE_SOURCE
  | typeof JOURNEY_DEVTOOLS_EXTENSION_SOURCE;

export type JourneyDevtoolsStepAsyncState = JourneyStepAsyncState;

export type JourneyDevtoolsSerializableSnapshot = JourneySnapshot<unknown, string>;

export type JourneyDevtoolsMachineMeta = {
  machineId: string;
  label: string;
  appName: string | null;
  commandsEnabled?: boolean;
};

export type JourneyDevtoolsSerializedError = {
  name: string | null;
  message: string;
  stack: string | null;
  cause: unknown;
};

export type JourneyDevtoolsCommand =
  | { type: "goToNextStep" }
  | { type: "terminateMachine" }
  | { type: "completeJourney" }
  | { type: "goToStepById"; stepId: string }
  | { type: "goToPreviousStep"; steps?: number }
  | { type: "goToLastVisitedStep" }
  | { type: "send"; event: { type: string; payload?: unknown } }
  | { type: "updateStepMetadata"; stepId: string; metadata: unknown }
  | { type: "resetMachine" }
  | { type: "clearStepError"; stepId?: string };

export type JourneyDevtoolsEnvelopeBase = {
  channel: typeof JOURNEY_DEVTOOLS_CHANNEL;
  version: typeof JOURNEY_DEVTOOLS_PROTOCOL_VERSION;
  source: JourneyDevtoolsSource;
  kind: string;
  machineId: string;
  timestamp: number;
};

export type JourneyDevtoolsBridgeRegisterEnvelope = JourneyDevtoolsEnvelopeBase & {
  source: typeof JOURNEY_DEVTOOLS_BRIDGE_SOURCE;
  kind: "register";
  meta: JourneyDevtoolsMachineMeta;
  snapshot: JourneyDevtoolsSerializableSnapshot;
};

export type JourneyDevtoolsBridgeUnregisterEnvelope = JourneyDevtoolsEnvelopeBase & {
  source: typeof JOURNEY_DEVTOOLS_BRIDGE_SOURCE;
  kind: "unregister";
};

export type JourneyDevtoolsBridgeSnapshotEnvelope = JourneyDevtoolsEnvelopeBase & {
  source: typeof JOURNEY_DEVTOOLS_BRIDGE_SOURCE;
  kind: "snapshot";
  snapshot: JourneyDevtoolsSerializableSnapshot;
};

export type JourneyDevtoolsBridgeCommandResultEnvelope = JourneyDevtoolsEnvelopeBase & {
  source: typeof JOURNEY_DEVTOOLS_BRIDGE_SOURCE;
  kind: "commandResult";
  requestId: string;
  snapshot: JourneyDevtoolsSerializableSnapshot;
  transitioned?: boolean;
  transitionId?: string;
};

export type JourneyDevtoolsBridgeCommandErrorEnvelope = JourneyDevtoolsEnvelopeBase & {
  source: typeof JOURNEY_DEVTOOLS_BRIDGE_SOURCE;
  kind: "commandError";
  requestId: string;
  error: JourneyDevtoolsSerializedError;
};

export type JourneyDevtoolsExtensionCommandEnvelope = JourneyDevtoolsEnvelopeBase & {
  source: typeof JOURNEY_DEVTOOLS_EXTENSION_SOURCE;
  kind: "command";
  requestId: string;
  command: JourneyDevtoolsCommand;
};

export type JourneyDevtoolsBridgeEnvelope =
  | JourneyDevtoolsBridgeRegisterEnvelope
  | JourneyDevtoolsBridgeUnregisterEnvelope
  | JourneyDevtoolsBridgeSnapshotEnvelope
  | JourneyDevtoolsBridgeCommandResultEnvelope
  | JourneyDevtoolsBridgeCommandErrorEnvelope;

export type JourneyDevtoolsExtensionEnvelope = JourneyDevtoolsExtensionCommandEnvelope;

export type JourneyDevtoolsEnvelope =
  | JourneyDevtoolsBridgeEnvelope
  | JourneyDevtoolsExtensionEnvelope;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isKnownSource = (value: unknown): value is JourneyDevtoolsSource =>
  value === JOURNEY_DEVTOOLS_BRIDGE_SOURCE || value === JOURNEY_DEVTOOLS_EXTENSION_SOURCE;

/**
 * Maximum depth for nested object validation.
 * Prevents stack overflow and excessive processing from deeply nested malicious payloads.
 */
const MAX_PAYLOAD_DEPTH = 10;

/**
 * Maximum size (in JSON string length) for serialized payloads.
 * Prevents memory exhaustion from extremely large payloads.
 */
const MAX_PAYLOAD_SIZE = 500_000; // 500KB

/**
 * Validates that a value is safe for transport.
 * Checks depth and size constraints to prevent malicious payloads.
 */
const isSafePayload = (value: unknown, depth = 0): boolean => {
  if (depth > MAX_PAYLOAD_DEPTH) {
    return false;
  }

  if (value === null || value === undefined) {
    return true;
  }

  const primitiveTypes = ["string", "number", "boolean"];
  if (primitiveTypes.includes(typeof value)) {
    return true;
  }

  if (typeof value === "object") {
    // Check JSON serialization size
    try {
      const serialized = JSON.stringify(value);
      if (serialized.length > MAX_PAYLOAD_SIZE) {
        return false;
      }
    } catch {
      // Circular references or non-serializable objects are not safe
      return false;
    }

    // Recursively validate nested objects and arrays
    if (Array.isArray(value)) {
      return value.every((item) => isSafePayload(item, depth + 1));
    }

    // Validate plain objects (guard against prototype pollution)
    if (
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    ) {
      return false;
    }

    return Object.values(value).every((prop) => isSafePayload(prop, depth + 1));
  }

  // Reject functions, symbols, and other non-serializable types
  return false;
};

const hasBaseEnvelopeShape = (value: unknown): value is JourneyDevtoolsEnvelopeBase => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.channel === JOURNEY_DEVTOOLS_CHANNEL &&
    value.version === JOURNEY_DEVTOOLS_PROTOCOL_VERSION &&
    isKnownSource(value.source) &&
    typeof value.kind === "string" &&
    typeof value.machineId === "string" &&
    typeof value.timestamp === "number"
  );
};

const isSendEvent = (value: unknown): value is { type: string; payload?: unknown } => {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.type !== "string" || value.type.length === 0 || value.type.length > 100) {
    return false;
  }

  // Validate payload if present
  if ("payload" in value && value.payload !== undefined) {
    return isSafePayload(value.payload);
  }

  return true;
};

export const isJourneyDevtoolsCommand = (value: unknown): value is JourneyDevtoolsCommand => {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  // Validate command type is within reasonable length
  if (value.type.length === 0 || value.type.length > 50) {
    return false;
  }

  switch (value.type) {
    case "goToNextStep":
    case "terminateMachine":
    case "completeJourney":
    case "resetMachine":
    case "goToLastVisitedStep":
      // These commands should have no extra properties beyond type
      return Object.keys(value).length === 1;
    case "goToStepById":
      return (
        typeof value.stepId === "string" &&
        value.stepId.length > 0 &&
        value.stepId.length <= 100 &&
        Object.keys(value).length === 2
      );
    case "goToPreviousStep":
      return (
        (value.steps === undefined ||
          (typeof value.steps === "number" &&
            Number.isInteger(value.steps) &&
            value.steps >= 1 &&
            value.steps <= 10000)) &&
        Object.keys(value).length <= 2
      );
    case "send":
      return isSendEvent(value.event) && Object.keys(value).length === 2;
    case "updateStepMetadata":
      return (
        typeof value.stepId === "string" &&
        value.stepId.length > 0 &&
        value.stepId.length <= 100 &&
        isSafePayload(value.metadata) &&
        Object.keys(value).length === 3
      );
    case "clearStepError":
      return (
        (value.stepId === undefined ||
          (typeof value.stepId === "string" && value.stepId.length <= 100)) &&
        Object.keys(value).length <= 2
      );
    default:
      return false;
  }
};

export const isJourneyDevtoolsBridgeEnvelope = (
  value: unknown
): value is JourneyDevtoolsBridgeEnvelope => {
  if (!hasBaseEnvelopeShape(value) || value.source !== JOURNEY_DEVTOOLS_BRIDGE_SOURCE) {
    return false;
  }

  const envelope = value as Record<string, unknown>;

  switch (value.kind) {
    case "register":
      return (
        isRecord(envelope.meta) &&
        isRecord(envelope.snapshot) &&
        isSafePayload(envelope.meta) &&
        isSafePayload(envelope.snapshot)
      );
    case "unregister":
      return true;
    case "snapshot":
      return isRecord(envelope.snapshot) && isSafePayload(envelope.snapshot);
    case "commandResult":
      return (
        typeof envelope.requestId === "string" &&
        envelope.requestId.length > 0 &&
        envelope.requestId.length <= 100 &&
        isRecord(envelope.snapshot) &&
        isSafePayload(envelope.snapshot)
      );
    case "commandError":
      return (
        typeof envelope.requestId === "string" &&
        envelope.requestId.length > 0 &&
        envelope.requestId.length <= 100 &&
        isRecord(envelope.error)
      );
    default:
      return false;
  }
};

export const isJourneyDevtoolsExtensionEnvelope = (
  value: unknown
): value is JourneyDevtoolsExtensionEnvelope => {
  if (!hasBaseEnvelopeShape(value) || value.source !== JOURNEY_DEVTOOLS_EXTENSION_SOURCE) {
    return false;
  }

  if (value.kind !== "command") {
    return false;
  }

  const envelope = value as Record<string, unknown>;
  return (
    typeof envelope.requestId === "string" &&
    envelope.requestId.length > 0 &&
    envelope.requestId.length <= 100 &&
    isJourneyDevtoolsCommand(envelope.command)
  );
};

export const isJourneyDevtoolsEnvelope = (value: unknown): value is JourneyDevtoolsEnvelope =>
  isJourneyDevtoolsBridgeEnvelope(value) || isJourneyDevtoolsExtensionEnvelope(value);
