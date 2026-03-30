import type {
  JourneyExecutionPathOptions,
  JourneyExecutionPathsResult,
  JourneyJsonObject,
  JourneyObservationEvent,
  JourneySnapshot,
  JourneyStepAsyncState
} from "@rxova/journey-core";

export const JOURNEY_DEVTOOLS_PROTOCOL_VERSION = 4 as const;
export const JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION = 3 as const;
export const JOURNEY_DEVTOOLS_CHANNEL = "__RXOVA_JOURNEY_DEVTOOLS__" as const;

export const JOURNEY_DEVTOOLS_BRIDGE_SOURCE = "rxova-journey-bridge" as const;
export const JOURNEY_DEVTOOLS_EXTENSION_SOURCE = "rxova-journey-extension" as const;

export type JourneyDevtoolsProtocolVersion =
  | typeof JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION
  | typeof JOURNEY_DEVTOOLS_PROTOCOL_VERSION;

export type JourneyDevtoolsSource =
  | typeof JOURNEY_DEVTOOLS_BRIDGE_SOURCE
  | typeof JOURNEY_DEVTOOLS_EXTENSION_SOURCE;

export type JourneyDevtoolsStepAsyncState = JourneyStepAsyncState;

export type JourneyDevtoolsSerializableSnapshot = JourneySnapshot<JourneyJsonObject, string>;
export type JourneyDevtoolsSerializableObservationEvent = JourneyObservationEvent<
  string,
  Record<never, never>
>;
export type JourneyDevtoolsSerializableExecutionPathsResult = JourneyExecutionPathsResult<
  string,
  string
>;

export type JourneyDevtoolsMachineCapabilities = {
  commands: JourneyDevtoolsCommand["type"][];
  observe: boolean;
  executionPaths: boolean;
  persistence?: {
    key: string | null;
    clearOnReset: boolean | null;
  };
};

export type JourneyDevtoolsMachineMeta = {
  machineId: string;
  label: string;
  appName: string | null;
  commandsEnabled?: boolean;
  capabilities?: JourneyDevtoolsMachineCapabilities;
};

export type JourneyDevtoolsSerializedError = {
  name: string | null;
  message: string;
  stack: string | null;
  cause: unknown;
};

export type JourneyDevtoolsCommand =
  | { type: "startJourney" }
  | { type: "goToNextStep" }
  | { type: "terminateJourney" }
  | { type: "completeJourney" }
  | { type: "goToStepById"; stepId: string }
  | { type: "goToPreviousStep"; steps?: number }
  | { type: "goToLastVisitedStep" }
  | { type: "send"; event: { type: string; payload?: unknown } }
  | { type: "resetJourney" }
  | { type: "clearStepError"; stepId?: string }
  | { type: "getExecutionPaths"; options?: JourneyExecutionPathOptions };

export type JourneyDevtoolsEnvelopeBase = {
  channel: typeof JOURNEY_DEVTOOLS_CHANNEL;
  version: JourneyDevtoolsProtocolVersion;
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

export type JourneyDevtoolsBridgeObservationEnvelope = JourneyDevtoolsEnvelopeBase & {
  source: typeof JOURNEY_DEVTOOLS_BRIDGE_SOURCE;
  kind: "observation";
  event: JourneyDevtoolsSerializableObservationEvent;
};

export type JourneyDevtoolsBridgeCommandResultEnvelope = JourneyDevtoolsEnvelopeBase & {
  source: typeof JOURNEY_DEVTOOLS_BRIDGE_SOURCE;
  kind: "commandResult";
  requestId: string;
  snapshot: JourneyDevtoolsSerializableSnapshot;
  transitioned?: boolean;
  transitionId?: string;
  error?: JourneyDevtoolsSerializedError;
};

export type JourneyDevtoolsBridgeExecutionPathsResultEnvelope = JourneyDevtoolsEnvelopeBase & {
  source: typeof JOURNEY_DEVTOOLS_BRIDGE_SOURCE;
  kind: "executionPathsResult";
  requestId: string;
  result: JourneyDevtoolsSerializableExecutionPathsResult;
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
  | JourneyDevtoolsBridgeObservationEnvelope
  | JourneyDevtoolsBridgeCommandResultEnvelope
  | JourneyDevtoolsBridgeExecutionPathsResultEnvelope
  | JourneyDevtoolsBridgeCommandErrorEnvelope;

export type JourneyDevtoolsExtensionEnvelope = JourneyDevtoolsExtensionCommandEnvelope;

export type JourneyDevtoolsEnvelope =
  | JourneyDevtoolsBridgeEnvelope
  | JourneyDevtoolsExtensionEnvelope;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isKnownSource = (value: unknown): value is JourneyDevtoolsSource =>
  value === JOURNEY_DEVTOOLS_BRIDGE_SOURCE || value === JOURNEY_DEVTOOLS_EXTENSION_SOURCE;

const isSupportedProtocolVersion = (value: unknown): value is JourneyDevtoolsProtocolVersion =>
  value === JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION || value === JOURNEY_DEVTOOLS_PROTOCOL_VERSION;

const JOURNEY_COMMAND_TYPES = [
  "startJourney",
  "goToNextStep",
  "terminateJourney",
  "completeJourney",
  "goToStepById",
  "goToPreviousStep",
  "goToLastVisitedStep",
  "send",
  "resetJourney",
  "clearStepError",
  "getExecutionPaths"
] as const;

const isKnownCommandType = (value: unknown): value is JourneyDevtoolsCommand["type"] =>
  typeof value === "string" && (JOURNEY_COMMAND_TYPES as readonly string[]).includes(value);

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
 * Checks size via a single serialization pass, then validates
 * depth, types, and prototype safety via a structure walk.
 */
const isSafePayload = (value: unknown): boolean => {
  try {
    const serialized = JSON.stringify(value);
    if (serialized !== undefined && serialized.length > MAX_PAYLOAD_SIZE) {
      return false;
    }
  } catch {
    return false;
  }

  return isStructureSafe(value, 0);
};

const isStructureSafe = (value: unknown, depth: number): boolean => {
  if (depth > MAX_PAYLOAD_DEPTH) {
    return false;
  }

  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }

  if (typeof value !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isStructureSafe(item, depth + 1));
  }

  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    return false;
  }

  return Object.values(value).every((prop) => isStructureSafe(prop, depth + 1));
};

const hasBaseEnvelopeShape = (value: unknown): value is JourneyDevtoolsEnvelopeBase => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.channel === JOURNEY_DEVTOOLS_CHANNEL &&
    isSupportedProtocolVersion(value.version) &&
    isKnownSource(value.source) &&
    typeof value.kind === "string" &&
    typeof value.machineId === "string" &&
    typeof value.timestamp === "number"
  );
};

const isPositiveInteger = (value: unknown, max = 10000): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= max;

const isExecutionPathOptionsShape = (value: unknown): value is JourneyExecutionPathOptions => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Object.keys(value).length <= 2 &&
    (value.maxDepth === undefined || isPositiveInteger(value.maxDepth)) &&
    (value.maxPaths === undefined || isPositiveInteger(value.maxPaths))
  );
};

const isSendEvent = (value: unknown): value is { type: string; payload?: unknown } => {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.type !== "string" || value.type.length === 0 || value.type.length > 100) {
    return false;
  }

  if ("payload" in value && value.payload !== undefined) {
    return isSafePayload(value.payload);
  }

  return true;
};

const isMachineCapabilities = (value: unknown): value is JourneyDevtoolsMachineCapabilities => {
  if (
    !isRecord(value) ||
    typeof value.observe !== "boolean" ||
    typeof value.executionPaths !== "boolean"
  ) {
    return false;
  }

  if (
    !Array.isArray(value.commands) ||
    !value.commands.every((command) => isKnownCommandType(command))
  ) {
    return false;
  }

  if (value.persistence === undefined) {
    return true;
  }

  if (!isRecord(value.persistence)) {
    return false;
  }

  return (
    (value.persistence.key === null || typeof value.persistence.key === "string") &&
    (value.persistence.clearOnReset === null || typeof value.persistence.clearOnReset === "boolean")
  );
};

const isMachineMeta = (
  value: unknown,
  version: JourneyDevtoolsProtocolVersion
): value is JourneyDevtoolsMachineMeta => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.machineId === "string" &&
    typeof value.label === "string" &&
    (value.appName === null || typeof value.appName === "string") &&
    (value.commandsEnabled === undefined || typeof value.commandsEnabled === "boolean") &&
    (version === JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION
      ? value.capabilities === undefined || isMachineCapabilities(value.capabilities)
      : isMachineCapabilities(value.capabilities))
  );
};

const isSerializableObservationEvent = (
  value: unknown
): value is JourneyDevtoolsSerializableObservationEvent => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.type === "string" &&
    value.type.length > 0 &&
    value.type.length <= 100 &&
    typeof value.timestamp === "number" &&
    isSafePayload(value)
  );
};

const isExecutionPathResult = (
  value: unknown
): value is JourneyDevtoolsSerializableExecutionPathsResult => {
  if (!isRecord(value) || !Array.isArray(value.paths)) {
    return false;
  }

  const isPathTerminated = (terminated: unknown): terminated is string =>
    terminated === "final" ||
    terminated === "depth" ||
    terminated === "cycle" ||
    terminated === "limit";

  return (
    value.paths.every(
      (path) =>
        isRecord(path) &&
        Array.isArray(path.steps) &&
        path.steps.every((step) => typeof step === "string") &&
        Array.isArray(path.events) &&
        path.events.every((event) => typeof event === "string") &&
        isPathTerminated(path.terminated)
    ) &&
    typeof value.truncated === "boolean" &&
    typeof value.cyclesDetected === "boolean"
  );
};

/**
 * Validates whether an unknown value is a supported devtools command payload.
 */
export const isJourneyDevtoolsCommand = (value: unknown): value is JourneyDevtoolsCommand => {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (value.type.length === 0 || value.type.length > 50) {
    return false;
  }

  switch (value.type) {
    case "startJourney":
    case "goToNextStep":
    case "terminateJourney":
    case "completeJourney":
    case "resetJourney":
    case "goToLastVisitedStep":
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
        (value.steps === undefined || isPositiveInteger(value.steps)) &&
        Object.keys(value).length <= 2
      );
    case "send":
      return isSendEvent(value.event) && Object.keys(value).length === 2;
    case "clearStepError":
      return (
        (value.stepId === undefined ||
          (typeof value.stepId === "string" && value.stepId.length <= 100)) &&
        Object.keys(value).length <= 2
      );
    case "getExecutionPaths":
      return (
        (value.options === undefined || isExecutionPathOptionsShape(value.options)) &&
        Object.keys(value).length <= 2
      );
    default:
      return false;
  }
};

/**
 * Validates whether an unknown value is a bridge-origin envelope.
 */
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
        isMachineMeta(envelope.meta, value.version) &&
        isRecord(envelope.snapshot) &&
        isSafePayload(envelope.snapshot)
      );
    case "unregister":
      return true;
    case "snapshot":
      return isRecord(envelope.snapshot) && isSafePayload(envelope.snapshot);
    case "observation":
      return isSerializableObservationEvent(envelope.event);
    case "commandResult":
      return (
        typeof envelope.requestId === "string" &&
        envelope.requestId.length > 0 &&
        envelope.requestId.length <= 100 &&
        isRecord(envelope.snapshot) &&
        isSafePayload(envelope.snapshot) &&
        (!("error" in envelope) || isRecord(envelope.error))
      );
    case "executionPathsResult":
      return (
        typeof envelope.requestId === "string" &&
        envelope.requestId.length > 0 &&
        envelope.requestId.length <= 100 &&
        isExecutionPathResult(envelope.result)
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

/**
 * Validates whether an unknown value is an extension-origin command envelope.
 */
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

/**
 * Validates whether an unknown value matches either supported devtools envelope shape.
 */
export const isJourneyDevtoolsEnvelope = (value: unknown): value is JourneyDevtoolsEnvelope =>
  isJourneyDevtoolsBridgeEnvelope(value) || isJourneyDevtoolsExtensionEnvelope(value);
