import { isRecord } from "@rxova/journey-common/predicates";
import type {
  JourneyDevtoolsBridgeEnvelope,
  JourneyDevtoolsEnvelope,
  JourneyDevtoolsEnvelopeBase,
  JourneyDevtoolsExtensionEnvelope,
  JourneyDevtoolsFieldSpec,
  JourneyDevtoolsMachineFeatureDescriptor,
  JourneyDevtoolsMachineMeta,
  JourneyDevtoolsMachineOperationDescriptor,
  JourneyDevtoolsOperationInvoke,
  JourneyDevtoolsOperationResultKind,
  JourneyDevtoolsOperationResultPayload,
  JourneyDevtoolsProtocolVersion,
  JourneyDevtoolsSource,
  JourneyDevtoolsStepFeatureDescriptor
} from "./protocol.types.js";

/**
 * Current devtools protocol version emitted by the bridge. v7 carries the
 * rewritten core's snapshot shape (discriminated `type`, timeline history,
 * `currentStep.async`) and drops the old per-source event maps.
 */
export const JOURNEY_DEVTOOLS_PROTOCOL_VERSION = 7 as const;
/**
 * Prior protocol version still accepted on the wire; its `invoke` envelope
 * shape is identical, so a v6 extension can drive a v7 bridge.
 */
export const JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION = 6 as const;
/** Oldest protocol version still tolerated for register envelopes. */
export const JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION = 5 as const;
/** `window.postMessage` channel discriminator for all devtools traffic. */
export const JOURNEY_DEVTOOLS_CHANNEL = "__RXOVA_JOURNEY_DEVTOOLS__" as const;
/** Message kind the extension sends to ask the bridge to re-emit register + snapshot. */
export const JOURNEY_DEVTOOLS_REPLAY_REQUEST = "__RXOVA_JOURNEY_DEVTOOLS_REPLAY_REQUEST__" as const;

/** `source` marker on envelopes the bridge sends to the extension. */
export const JOURNEY_DEVTOOLS_BRIDGE_SOURCE = "rxova-journey-bridge" as const;
/** `source` marker on envelopes the extension sends to the bridge. */
export const JOURNEY_DEVTOOLS_EXTENSION_SOURCE = "rxova-journey-extension" as const;

/**
 * Whether the bridge can process an `invoke` from a given protocol version.
 * Accepts the current and prior versions (their invoke shapes are identical);
 * the legacy version is tolerated for register envelopes but cannot invoke.
 */
export const isCompatibleInvokeProtocolVersion = (
  value: unknown
): value is
  | typeof JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION
  | typeof JOURNEY_DEVTOOLS_PROTOCOL_VERSION =>
  value === JOURNEY_DEVTOOLS_PROTOCOL_VERSION || value === JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION;

const isKnownSource = (value: unknown): value is JourneyDevtoolsSource =>
  value === JOURNEY_DEVTOOLS_BRIDGE_SOURCE || value === JOURNEY_DEVTOOLS_EXTENSION_SOURCE;

const isSupportedProtocolVersion = (value: unknown): value is JourneyDevtoolsProtocolVersion =>
  value === JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION ||
  value === JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION ||
  value === JOURNEY_DEVTOOLS_PROTOCOL_VERSION;

const MAX_PAYLOAD_DEPTH = 10;
const MAX_PAYLOAD_SIZE = 500_000;

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

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isStepFeatureDescriptor = (value: unknown): value is JourneyDevtoolsStepFeatureDescriptor =>
  isRecord(value) &&
  typeof value.hasOnEnter === "boolean" &&
  typeof value.hasOnLeave === "boolean" &&
  typeof value.hasMetadata === "boolean";

const isFieldType = (value: unknown): value is JourneyDevtoolsFieldSpec["type"] =>
  value === "text" || value === "integer" || value === "boolean" || value === "json";

const isFieldDescriptor = (value: unknown): value is JourneyDevtoolsFieldSpec => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.key === "string" &&
    value.key.length > 0 &&
    typeof value.label === "string" &&
    value.label.length > 0 &&
    isFieldType(value.type) &&
    (value.required === undefined || typeof value.required === "boolean") &&
    (value.description === undefined || typeof value.description === "string") &&
    (value.placeholder === undefined || typeof value.placeholder === "string") &&
    (value.min === undefined || typeof value.min === "number") &&
    (value.max === undefined || typeof value.max === "number")
  );
};

const isResultKind = (value: unknown): value is JourneyDevtoolsOperationResultKind =>
  value === "snapshot" || value === "data" || value === "text" || value === "void";

const isOperationDescriptor = (
  value: unknown
): value is JourneyDevtoolsMachineOperationDescriptor => {
  if (!isRecord(value) || !Array.isArray(value.fields)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.label === "string" &&
    value.label.length > 0 &&
    isNullableString(value.description) &&
    typeof value.mutates === "boolean" &&
    isResultKind(value.output) &&
    value.fields.every((field) => isFieldDescriptor(field))
  );
};

const isFeatureDescriptor = (value: unknown): value is JourneyDevtoolsMachineFeatureDescriptor => {
  if (!isRecord(value) || !Array.isArray(value.operations)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.label === "string" &&
    value.label.length > 0 &&
    isNullableString(value.description) &&
    value.operations.every((operation) => isOperationDescriptor(operation))
  );
};

const isMachineMeta = (
  value: unknown,
  version: JourneyDevtoolsProtocolVersion
): value is JourneyDevtoolsMachineMeta => {
  if (!isRecord(value) || !Array.isArray(value.features)) {
    return false;
  }

  return (
    typeof value.machineId === "string" &&
    typeof value.label === "string" &&
    (value.appName === null || typeof value.appName === "string") &&
    (version === JOURNEY_DEVTOOLS_PROTOCOL_VERSION
      ? typeof value.mutationsEnabled === "boolean"
      : value.mutationsEnabled === undefined || typeof value.mutationsEnabled === "boolean") &&
    (value.mode === undefined ||
      value.mode === "linear" ||
      value.mode === "graph" ||
      value.mode === "headless") &&
    (value.stepIds === undefined || isStringArray(value.stepIds)) &&
    (value.eventTypes === undefined || isStringArray(value.eventTypes)) &&
    (value.steps === undefined ||
      (isRecord(value.steps) &&
        Object.values(value.steps).every((step) => isStepFeatureDescriptor(step)))) &&
    value.features.every((feature) => isFeatureDescriptor(feature))
  );
};

const isOperationInvoke = (value: unknown): value is JourneyDevtoolsOperationInvoke => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.operationId === "string" &&
    value.operationId.length > 0 &&
    value.operationId.length <= 200 &&
    (value.input === undefined || isSafePayload(value.input))
  );
};

const isResultPayload = (value: unknown): value is JourneyDevtoolsOperationResultPayload => {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return false;
  }

  switch (value.kind) {
    case "snapshot":
      return (
        isRecord(value.snapshot) &&
        isSafePayload(value.snapshot) &&
        (value.transitioned === undefined || typeof value.transitioned === "boolean") &&
        (value.error === undefined || isRecord(value.error))
      );
    case "data":
      return isSafePayload(value.data);
    case "text":
      return typeof value.text === "string";
    case "void":
      return Object.keys(value).length === 1;
    default:
      return false;
  }
};

/** Returns true when a payload matches the bridge-to-extension devtools envelope shape. */
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
      return isRecord(envelope.event) && isSafePayload(envelope.event);
    case "operationResult":
      return (
        typeof envelope.requestId === "string" &&
        typeof envelope.operationId === "string" &&
        isResultPayload(envelope.result)
      );
    case "operationError":
      return (
        typeof envelope.requestId === "string" &&
        typeof envelope.operationId === "string" &&
        isRecord(envelope.error)
      );
    default:
      return false;
  }
};

/** Returns true when a payload matches the extension-to-bridge devtools envelope shape. */
export const isJourneyDevtoolsExtensionEnvelope = (
  value: unknown
): value is JourneyDevtoolsExtensionEnvelope => {
  if (!hasBaseEnvelopeShape(value) || value.source !== JOURNEY_DEVTOOLS_EXTENSION_SOURCE) {
    return false;
  }
  if (value.kind !== "invoke") {
    return false;
  }

  const envelope = value as Record<string, unknown>;
  return typeof envelope.requestId === "string" && isOperationInvoke(envelope.invocation);
};

/** Returns true when a payload matches any supported journey devtools protocol envelope. */
export const isJourneyDevtoolsEnvelope = (value: unknown): value is JourneyDevtoolsEnvelope =>
  isJourneyDevtoolsBridgeEnvelope(value) || isJourneyDevtoolsExtensionEnvelope(value);
