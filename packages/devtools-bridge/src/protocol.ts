import type {
  JourneyJsonObject,
  JourneyMachineDevtoolsFieldSpec,
  JourneyMachineDevtoolsOperationResultKind,
  JourneySnapshot,
  JourneyStepAsyncState
} from "@rxova/journey-core";
import { isRecord } from "@rxova/journey-common/predicates";

/** Current devtools protocol version emitted by the bridge. */
export const JOURNEY_DEVTOOLS_PROTOCOL_VERSION = 6 as const;
/**
 * Prior protocol version still accepted on the wire. v6 added per-step feature
 * metadata to the register envelope; the `invoke` envelope shape is unchanged
 * from v5, so a v6 bridge and a v5 extension interoperate.
 */
export const JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION = 5 as const;
/** Oldest protocol version still tolerated for register envelopes. */
export const JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION = 3 as const;
/** `window.postMessage` channel discriminator for all devtools traffic. */
export const JOURNEY_DEVTOOLS_CHANNEL = "__RXOVA_JOURNEY_DEVTOOLS__" as const;
/** Message kind the extension sends to ask the bridge to re-emit register + snapshot. */
export const JOURNEY_DEVTOOLS_REPLAY_REQUEST = "__RXOVA_JOURNEY_DEVTOOLS_REPLAY_REQUEST__" as const;

/** `source` marker on envelopes the bridge sends to the extension. */
export const JOURNEY_DEVTOOLS_BRIDGE_SOURCE = "rxova-journey-bridge" as const;
/** `source` marker on envelopes the extension sends to the bridge. */
export const JOURNEY_DEVTOOLS_EXTENSION_SOURCE = "rxova-journey-extension" as const;

/** Protocol versions accepted on the wire (current, prior, and legacy). */
export type JourneyDevtoolsProtocolVersion =
  | typeof JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION
  | typeof JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION
  | typeof JOURNEY_DEVTOOLS_PROTOCOL_VERSION;

/**
 * Whether the bridge can process an `invoke` from a given protocol version.
 * Accepts the current and prior versions (their invoke shapes are identical);
 * the v3 legacy version is tolerated for register envelopes but cannot invoke.
 */
export const isCompatibleInvokeProtocolVersion = (
  value: unknown
): value is
  | typeof JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION
  | typeof JOURNEY_DEVTOOLS_PROTOCOL_VERSION =>
  value === JOURNEY_DEVTOOLS_PROTOCOL_VERSION || value === JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION;

export type JourneyDevtoolsSource =
  | typeof JOURNEY_DEVTOOLS_BRIDGE_SOURCE
  | typeof JOURNEY_DEVTOOLS_EXTENSION_SOURCE;

/** Per-step async state as carried over the wire. */
export type JourneyDevtoolsStepAsyncState = JourneyStepAsyncState;
/** A journey snapshot serialized for transport to the extension. */
export type JourneyDevtoolsSerializableSnapshot = JourneySnapshot<JourneyJsonObject, string>;

/** Metadata describing one devtools-invokable operation (id, label, inputs, output kind). */
export type JourneyDevtoolsMachineOperationDescriptor = {
  id: string;
  label: string;
  description: string | null;
  mutates: boolean;
  output: JourneyMachineDevtoolsOperationResultKind;
  fields: readonly JourneyMachineDevtoolsFieldSpec[];
};

/** A named group of devtools operations (core navigation, plugin features, …). */
export type JourneyDevtoolsMachineFeatureDescriptor = {
  id: string;
  label: string;
  description: string | null;
  operations: readonly JourneyDevtoolsMachineOperationDescriptor[];
};

/**
 * Per-step authored features, surfaced so devtools can show which steps carry
 * an effect, delayed (`after`) transitions, lifecycle callbacks, or metadata.
 * Added in protocol v6; absent on v5/v3 register envelopes.
 */
export type JourneyDevtoolsStepFeatureDescriptor = {
  hasEffect: boolean;
  /** Delays (ms) of the step's `after` transitions, ascending. Empty when none. */
  afterDelays: readonly number[];
  hasOnEnter: boolean;
  hasOnLeave: boolean;
  hasMeta: boolean;
};

/** Static description of a machine sent in the `register` envelope: identity, mode, steps, events, and features. */
export type JourneyDevtoolsMachineMeta = {
  machineId: string;
  label: string;
  appName: string | null;
  mutationsEnabled?: boolean;
  mode?: "linear" | "graph" | "headless";
  stepIds?: readonly string[];
  eventTypes?: readonly string[];
  eventTypesBySource?: Record<string, readonly string[]>;
  goToStepTargetsBySource?: Record<string, readonly string[]>;
  steps?: Record<string, JourneyDevtoolsStepFeatureDescriptor>;
  features: readonly JourneyDevtoolsMachineFeatureDescriptor[];
};

export type JourneyDevtoolsSerializedError = {
  name: string | null;
  message: string;
  stack: string | null;
  cause: unknown;
};

export type JourneyDevtoolsOperationInvoke = {
  operationId: string;
  input?: Record<string, unknown>;
};

export type JourneyDevtoolsOperationResultPayload =
  | {
      kind: "snapshot";
      snapshot: JourneyDevtoolsSerializableSnapshot;
      transitioned?: boolean;
      transitionId?: string;
      error?: JourneyDevtoolsSerializedError;
    }
  | {
      kind: "data";
      data: unknown;
    }
  | {
      kind: "text";
      text: string;
    }
  | {
      kind: "void";
    };

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
  event: Record<string, unknown>;
};

export type JourneyDevtoolsBridgeOperationResultEnvelope = JourneyDevtoolsEnvelopeBase & {
  source: typeof JOURNEY_DEVTOOLS_BRIDGE_SOURCE;
  kind: "operationResult";
  requestId: string;
  operationId: string;
  result: JourneyDevtoolsOperationResultPayload;
};

export type JourneyDevtoolsBridgeOperationErrorEnvelope = JourneyDevtoolsEnvelopeBase & {
  source: typeof JOURNEY_DEVTOOLS_BRIDGE_SOURCE;
  kind: "operationError";
  requestId: string;
  operationId: string;
  error: JourneyDevtoolsSerializedError;
};

export type JourneyDevtoolsExtensionInvokeEnvelope = JourneyDevtoolsEnvelopeBase & {
  source: typeof JOURNEY_DEVTOOLS_EXTENSION_SOURCE;
  kind: "invoke";
  requestId: string;
  invocation: JourneyDevtoolsOperationInvoke;
};

export type JourneyDevtoolsBridgeEnvelope =
  | JourneyDevtoolsBridgeRegisterEnvelope
  | JourneyDevtoolsBridgeUnregisterEnvelope
  | JourneyDevtoolsBridgeSnapshotEnvelope
  | JourneyDevtoolsBridgeObservationEnvelope
  | JourneyDevtoolsBridgeOperationResultEnvelope
  | JourneyDevtoolsBridgeOperationErrorEnvelope;

export type JourneyDevtoolsExtensionEnvelope = JourneyDevtoolsExtensionInvokeEnvelope;

export type JourneyDevtoolsEnvelope =
  | JourneyDevtoolsBridgeEnvelope
  | JourneyDevtoolsExtensionEnvelope;

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

const isNumberArray = (value: unknown): value is readonly number[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "number");

const isStepFeatureDescriptor = (value: unknown): value is JourneyDevtoolsStepFeatureDescriptor =>
  isRecord(value) &&
  typeof value.hasEffect === "boolean" &&
  isNumberArray(value.afterDelays) &&
  typeof value.hasOnEnter === "boolean" &&
  typeof value.hasOnLeave === "boolean" &&
  typeof value.hasMeta === "boolean";

const isFieldType = (value: unknown): value is JourneyMachineDevtoolsFieldSpec["type"] =>
  value === "text" || value === "integer" || value === "boolean" || value === "json";

const isFieldDescriptor = (value: unknown): value is JourneyMachineDevtoolsFieldSpec => {
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

const isResultKind = (value: unknown): value is JourneyMachineDevtoolsOperationResultKind =>
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
    (value.eventTypesBySource === undefined ||
      (isRecord(value.eventTypesBySource) &&
        Object.values(value.eventTypesBySource).every((targets) => isStringArray(targets)))) &&
    (value.goToStepTargetsBySource === undefined ||
      (isRecord(value.goToStepTargetsBySource) &&
        Object.values(value.goToStepTargetsBySource).every((targets) => isStringArray(targets)))) &&
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
        (value.transitionId === undefined || typeof value.transitionId === "string") &&
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
