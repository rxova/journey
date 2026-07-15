import type {
  JourneyDevtoolsBridgeEnvelope,
  JourneyDevtoolsMachineMeta,
  JourneyDevtoolsOperationInvoke,
  JourneyDevtoolsProtocolVersion,
  JourneyDevtoolsSerializableSnapshot
} from "@rxova/journey-devtools-bridge";
import { JOURNEY_DEVTOOLS_PROTOCOL_VERSION } from "@rxova/journey-devtools-bridge";
import type {
  JourneyPanelMachineMeta,
  JourneyPanelMachineState,
  JourneyPanelPendingCommand,
  JourneyPanelTimelineEntry,
  NonUnregisterBridgeEnvelope,
  TimelineEnvelopeKind
} from "./types";
import { MAX_MACHINE_TIMELINE_ENTRIES } from "./types";
import { getSnapshotCurrentStepId } from "../utils/snapshot";

export const buildJourneyMachineState = (
  machineId: string,
  snapshot: JourneyDevtoolsSerializableSnapshot,
  protocolVersion: JourneyDevtoolsProtocolVersion = JOURNEY_DEVTOOLS_PROTOCOL_VERSION
): JourneyPanelMachineState => ({
  meta: {
    machineId,
    label: machineId,
    appName: null,
    mutationsEnabled: true,
    features: []
  },
  protocolVersion,
  snapshot,
  timelineEntries: [],
  selectedTimelineIndex: 0,
  followLatest: true,
  timelineSequence: 0,
  pendingCommandsByRequestId: {}
});

export const normalizeMachineMeta = (
  meta: JourneyDevtoolsMachineMeta
): JourneyPanelMachineMeta => ({
  ...meta,
  mutationsEnabled: meta.mutationsEnabled ?? true,
  features: meta.features ?? []
});

export const applyMachineUpdateForEnvelope = (
  machine: JourneyPanelMachineState,
  envelope: NonUnregisterBridgeEnvelope,
  options: {
    applyOperationResultSnapshot?: boolean;
  } = {}
): JourneyPanelMachineState => {
  switch (envelope.kind) {
    case "register":
      return {
        ...machine,
        meta: normalizeMachineMeta(envelope.meta),
        protocolVersion: envelope.version,
        snapshot: envelope.snapshot
      };
    case "snapshot":
      return { ...machine, protocolVersion: envelope.version, snapshot: envelope.snapshot };
    case "operationResult":
      return {
        ...machine,
        protocolVersion: envelope.version,
        snapshot:
          options.applyOperationResultSnapshot !== false && envelope.result.kind === "snapshot"
            ? envelope.result.snapshot
            : machine.snapshot
      };
    default:
      return machine;
  }
};

const buildEntryId = (
  machineId: string,
  envelopeKind: TimelineEnvelopeKind,
  timestamp: number,
  nextSequence: number
): string => `${machineId}-timeline-${envelopeKind}-${timestamp}-${nextSequence}`;

const buildOperationLabel = (operationId: string, prefix: "OP" | "ERROR" | "EVENT" | "SNAPSHOT") =>
  `${prefix}/${operationId}`;

export const buildQueuedTimelineEntry = (
  machine: JourneyPanelMachineState,
  machineId: string,
  requestId: string,
  invocation: JourneyDevtoolsOperationInvoke,
  timestamp: number
): JourneyPanelTimelineEntry => {
  const nextSequence = (machine.timelineSequence ?? machine.timelineEntries.length) + 1;
  return {
    id: buildEntryId(machineId, "queuedOperation", timestamp, nextSequence),
    timestamp,
    kind: "operation",
    label: buildOperationLabel(invocation.operationId, "OP"),
    requestId,
    invocation,
    envelopeKind: "queuedOperation",
    snapshot: null,
    actionPayload: {
      machineId,
      requestId,
      invocation
    },
    meta: {
      machineId,
      operationId: invocation.operationId
    }
  };
};

export const buildTimelineEntry = (
  machine: JourneyPanelMachineState,
  envelope: Exclude<JourneyDevtoolsBridgeEnvelope, { kind: "unregister" }>
): JourneyPanelTimelineEntry => {
  const nextSequence = (machine.timelineSequence ?? machine.timelineEntries.length) + 1;

  switch (envelope.kind) {
    case "register":
      return {
        id: buildEntryId(envelope.machineId, envelope.kind, envelope.timestamp, nextSequence),
        timestamp: envelope.timestamp,
        kind: "init",
        label: "@@INIT",
        requestId: null,
        invocation: null,
        envelopeKind: envelope.kind,
        snapshot: envelope.snapshot,
        actionPayload: { machineId: envelope.machineId, meta: envelope.meta },
        meta: { machineId: envelope.machineId }
      };
    case "snapshot":
      return {
        id: buildEntryId(envelope.machineId, envelope.kind, envelope.timestamp, nextSequence),
        timestamp: envelope.timestamp,
        kind: "snapshot",
        label: buildOperationLabel(
          getSnapshotCurrentStepId(envelope.snapshot) ?? envelope.snapshot.status,
          "SNAPSHOT"
        ),
        requestId: null,
        invocation: null,
        envelopeKind: envelope.kind,
        snapshot: envelope.snapshot,
        actionPayload: envelope.snapshot,
        meta: { machineId: envelope.machineId }
      };
    case "observation":
      return {
        id: buildEntryId(envelope.machineId, envelope.kind, envelope.timestamp, nextSequence),
        timestamp: envelope.timestamp,
        kind: "event",
        label: buildOperationLabel(String(envelope.event.type ?? "event"), "EVENT"),
        requestId: null,
        invocation: null,
        envelopeKind: envelope.kind,
        snapshot: null,
        actionPayload: envelope.event,
        meta: { machineId: envelope.machineId }
      };
    case "operationResult": {
      const pending = machine.pendingCommandsByRequestId[envelope.requestId] ?? null;
      const snapshot = envelope.result.kind === "snapshot" ? envelope.result.snapshot : null;
      return {
        id: buildEntryId(envelope.machineId, envelope.kind, envelope.timestamp, nextSequence),
        timestamp: envelope.timestamp,
        kind: "operation",
        label: buildOperationLabel(envelope.operationId, "OP"),
        requestId: envelope.requestId,
        invocation: pending?.invocation ?? null,
        envelopeKind: envelope.kind,
        snapshot,
        actionPayload: envelope.result,
        meta: {
          machineId: envelope.machineId,
          operationId: envelope.operationId,
          ...(envelope.result.kind === "snapshot" && envelope.result.transitioned !== undefined
            ? { transitioned: envelope.result.transitioned }
            : {}),
          ...(envelope.result.kind === "snapshot" &&
          "transitionId" in envelope.result &&
          typeof envelope.result.transitionId === "string"
            ? { transitionId: envelope.result.transitionId }
            : {})
        }
      };
    }
    case "operationError": {
      const pending = machine.pendingCommandsByRequestId[envelope.requestId] ?? null;
      return {
        id: buildEntryId(envelope.machineId, envelope.kind, envelope.timestamp, nextSequence),
        timestamp: envelope.timestamp,
        kind: "error",
        label: buildOperationLabel(envelope.operationId, "ERROR"),
        requestId: envelope.requestId,
        invocation: pending?.invocation ?? null,
        envelopeKind: envelope.kind,
        snapshot: null,
        actionPayload: envelope.error,
        meta: {
          machineId: envelope.machineId,
          operationId: envelope.operationId,
          errorMessage: envelope.error.message
        }
      };
    }
  }
};

export const appendTimelineEntry = (
  machine: JourneyPanelMachineState,
  entry: JourneyPanelTimelineEntry
): JourneyPanelMachineState => {
  const nextSequence = (machine.timelineSequence ?? machine.timelineEntries.length) + 1;
  const entriesWithNext = [...machine.timelineEntries, entry];
  const overflow = Math.max(0, entriesWithNext.length - MAX_MACHINE_TIMELINE_ENTRIES);
  const nextEntries = overflow > 0 ? entriesWithNext.slice(overflow) : entriesWithNext;
  const lastIndex = Math.max(0, nextEntries.length - 1);
  const boundedSelectedIndex = Math.max(0, machine.selectedTimelineIndex - overflow);

  return {
    ...machine,
    timelineEntries: nextEntries,
    timelineSequence: nextSequence,
    selectedTimelineIndex: machine.followLatest
      ? lastIndex
      : Math.min(boundedSelectedIndex, lastIndex)
  };
};

export const replaceTimelineEntry = (
  machine: JourneyPanelMachineState,
  entryId: string,
  nextEntry: JourneyPanelTimelineEntry
): JourneyPanelMachineState => {
  const index = machine.timelineEntries.findIndex((entry) => entry.id === entryId);
  if (index === -1) {
    return appendTimelineEntry(machine, nextEntry);
  }

  const nextEntries = [...machine.timelineEntries];
  nextEntries[index] = nextEntry;
  return { ...machine, timelineEntries: nextEntries };
};

export const pruneTimelineEntries = (
  machine: JourneyPanelMachineState,
  keep: number
): JourneyPanelMachineState => {
  const safeKeep = Math.max(0, keep);
  if (safeKeep >= machine.timelineEntries.length) {
    return machine;
  }

  const removedCount = machine.timelineEntries.length - safeKeep;
  const nextEntries = machine.timelineEntries.slice(machine.timelineEntries.length - safeKeep);
  const lastIndex = Math.max(0, nextEntries.length - 1);
  const boundedSelectedIndex = Math.max(0, machine.selectedTimelineIndex - removedCount);

  return {
    ...machine,
    timelineEntries: nextEntries,
    selectedTimelineIndex: machine.followLatest
      ? lastIndex
      : Math.min(boundedSelectedIndex, lastIndex)
  };
};

export const upsertJourneyMachineOrder = (order: string[], machineId: string): string[] =>
  order.includes(machineId) ? order : [...order, machineId];

export const removeJourneyMachineOrder = (order: string[], machineId: string): string[] =>
  order.filter((id) => id !== machineId);

export const clearPendingCommand = (
  pendingCommandsByRequestId: Record<string, JourneyPanelPendingCommand>,
  requestId: string
) => {
  if (!(requestId in pendingCommandsByRequestId)) {
    return pendingCommandsByRequestId;
  }

  const nextPendingCommands = { ...pendingCommandsByRequestId };
  delete nextPendingCommands[requestId];
  return nextPendingCommands;
};

export const resolveSnapshotAtIndex = (
  entries: readonly JourneyPanelTimelineEntry[],
  index: number
): JourneyDevtoolsSerializableSnapshot | null => {
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const candidate = entries[cursor]?.snapshot;
    if (candidate) {
      return candidate;
    }
  }

  return null;
};
