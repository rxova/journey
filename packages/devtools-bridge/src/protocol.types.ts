import type { JourneySnapshot } from "@rxova/journey-core";
import type {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
  JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION,
  JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION
} from "./protocol";

/** Protocol versions accepted on the wire (current, prior, and legacy). */
export type JourneyDevtoolsProtocolVersion =
  | typeof JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION
  | typeof JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION
  | typeof JOURNEY_DEVTOOLS_PROTOCOL_VERSION;

export type JourneyDevtoolsSource =
  | typeof JOURNEY_DEVTOOLS_BRIDGE_SOURCE
  | typeof JOURNEY_DEVTOOLS_EXTENSION_SOURCE;

/**
 * A journey snapshot serialized for transport to the extension. Protocol v7
 * carries the redesigned core snapshot (discriminated on `type`, timeline
 * history, per-step async state on `currentStep`).
 */
export type JourneyDevtoolsSerializableSnapshot = JourneySnapshot;

/** Input field spec for a devtools-invokable operation form. */
export type JourneyDevtoolsFieldSpec = {
  key: string;
  label: string;
  type: "text" | "integer" | "boolean" | "json";
  required?: boolean;
  description?: string;
  placeholder?: string;
  min?: number;
  max?: number;
};

/** Result shapes an operation may produce. */
export type JourneyDevtoolsOperationResultKind = "snapshot" | "data" | "text" | "void";

/** Metadata describing one devtools-invokable operation (id, label, inputs, output kind). */
export type JourneyDevtoolsMachineOperationDescriptor = {
  id: string;
  label: string;
  description: string | null;
  mutates: boolean;
  output: JourneyDevtoolsOperationResultKind;
  fields: readonly JourneyDevtoolsFieldSpec[];
};

/** A named group of devtools operations (lifecycle, navigation, events, …). */
export type JourneyDevtoolsMachineFeatureDescriptor = {
  id: string;
  label: string;
  description: string | null;
  operations: readonly JourneyDevtoolsMachineOperationDescriptor[];
};

/**
 * Per-step authored features. Protocol v7 reduces this to the hooks the
 * redesigned core supports; the bridge itself cannot inspect step configs, so
 * emitters that lack the definition omit `steps` entirely.
 */
export type JourneyDevtoolsStepFeatureDescriptor = {
  hasOnEnter: boolean;
  hasOnLeave: boolean;
  hasMetadata: boolean;
};

/** Static description of a machine sent in the `register` envelope. */
export type JourneyDevtoolsMachineMeta = {
  machineId: string;
  label: string;
  appName: string | null;
  mutationsEnabled?: boolean;
  mode?: "linear" | "graph" | "headless";
  stepIds?: readonly string[];
  eventTypes?: readonly string[];
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
