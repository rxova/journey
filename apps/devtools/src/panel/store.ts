import type {
  JourneyDevtoolsBridgeEnvelope,
  JourneyDevtoolsMachineFeatureDescriptor,
  JourneyDevtoolsMachineMeta,
  JourneyDevtoolsOperationInvoke,
  JourneyDevtoolsProtocolVersion,
  JourneyDevtoolsSerializableSnapshot
} from "@rxova/journey-devtools-bridge";
import { JOURNEY_DEVTOOLS_PROTOCOL_VERSION } from "@rxova/journey-devtools-bridge";
import {
  EMPTY_STRUCTURED_DIFF,
  computeStructuredDiff,
  type JourneyPanelStructuredDiff
} from "./diff";

type TimelineEnvelopeKind =
  | Exclude<JourneyDevtoolsBridgeEnvelope["kind"], "unregister">
  | "queuedOperation";
type NonUnregisterBridgeEnvelope = Exclude<JourneyDevtoolsBridgeEnvelope, { kind: "unregister" }>;

export type JourneyPanelTimelineKind = "init" | "snapshot" | "operation" | "event" | "error";

export type JourneyPanelPendingCommand = {
  requestId: string;
  invocation: JourneyDevtoolsOperationInvoke;
  timestamp: number;
  timelineEntryId: string;
};

export type JourneyPanelTimelineEntry = {
  id: string;
  timestamp: number;
  kind: JourneyPanelTimelineKind;
  label: string;
  requestId: string | null;
  invocation: JourneyDevtoolsOperationInvoke | null;
  envelopeKind: TimelineEnvelopeKind;
  snapshot: JourneyDevtoolsSerializableSnapshot | null;
  actionPayload: unknown;
  meta: {
    machineId: string;
    operationId?: string;
    transitioned?: boolean;
    transitionId?: string;
    errorMessage?: string;
  };
};

type JourneyPanelMachineMeta = JourneyDevtoolsMachineMeta & {
  mutationsEnabled: boolean;
  features: readonly JourneyDevtoolsMachineFeatureDescriptor[];
};

export type JourneyPanelMachineState = {
  meta: JourneyPanelMachineMeta;
  protocolVersion?: JourneyDevtoolsProtocolVersion;
  snapshot: JourneyDevtoolsSerializableSnapshot;
  timelineEntries: JourneyPanelTimelineEntry[];
  selectedTimelineIndex: number;
  followLatest: boolean;
  timelineSequence?: number;
  pendingCommandsByRequestId: Record<string, JourneyPanelPendingCommand>;
};

export type JourneyPanelState = {
  connected: boolean;
  machines: Record<string, JourneyPanelMachineState>;
  machineOrder: string[];
  selectedMachineId: string | null;
  displayLimit: number | null;
};

export type JourneyPanelAction =
  | { type: "set-connected"; connected: boolean }
  | { type: "clear-machines" }
  | { type: "bridge-envelope"; envelope: JourneyDevtoolsBridgeEnvelope }
  | { type: "select-machine"; machineId: string }
  | { type: "set-display-limit"; limit: number | null }
  | { type: "set-follow-latest"; machineId: string; followLatest: boolean }
  | { type: "select-timeline-entry"; machineId: string; index: number }
  | { type: "prune-timeline"; machineId: string; keep: number | null }
  | {
      type: "queue-command";
      machineId: string;
      requestId: string;
      invocation: JourneyDevtoolsOperationInvoke;
      timestamp: number;
    };

export const MAX_MACHINE_TIMELINE_ENTRIES = 2000;

const initialSnapshot: JourneyDevtoolsSerializableSnapshot = {
  currentStepId: "unknown",
  history: { timeline: ["unknown"], index: 0 },
  context: {},
  visited: {},
  status: "idled",
  async: { isLoading: false, byStep: {} }
};

const buildJourneyMachineState = (
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

const normalizeMachineMeta = (meta: JourneyDevtoolsMachineMeta): JourneyPanelMachineMeta => ({
  ...meta,
  mutationsEnabled: meta.mutationsEnabled ?? true,
  features: meta.features ?? []
});

export const applyMachineUpdateForEnvelope = (
  machine: JourneyPanelMachineState,
  envelope: NonUnregisterBridgeEnvelope
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
        snapshot: envelope.result.kind === "snapshot" ? envelope.result.snapshot : machine.snapshot
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

const buildQueuedTimelineEntry = (
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

const buildTimelineEntry = (
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
        label: buildOperationLabel(envelope.snapshot.currentStepId, "SNAPSHOT"),
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
          ...(envelope.result.kind === "snapshot" && envelope.result.transitionId !== undefined
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

const appendTimelineEntry = (
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

const replaceTimelineEntry = (
  machine: JourneyPanelMachineState,
  entryId: string,
  nextEntry: JourneyPanelTimelineEntry
) => {
  const index = machine.timelineEntries.findIndex((entry) => entry.id === entryId);
  if (index === -1) {
    return appendTimelineEntry(machine, nextEntry);
  }
  const nextEntries = [...machine.timelineEntries];
  nextEntries[index] = nextEntry;
  return { ...machine, timelineEntries: nextEntries };
};

const pruneTimelineEntries = (machine: JourneyPanelMachineState, keep: number) => {
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

const upsertJourneyMachineOrder = (order: string[], machineId: string): string[] =>
  order.includes(machineId) ? order : [...order, machineId];

const removeJourneyMachineOrder = (order: string[], machineId: string): string[] =>
  order.filter((id) => id !== machineId);

const clearPendingCommand = (
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

const resolveSnapshotAtIndex = (
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

export const createInitialPanelState = (): JourneyPanelState => ({
  connected: false,
  machines: {},
  machineOrder: [],
  selectedMachineId: null,
  displayLimit: null
});

export const panelReducer = (
  state: JourneyPanelState,
  action: JourneyPanelAction
): JourneyPanelState => {
  if (action.type === "clear-machines") {
    return { ...state, machines: {}, machineOrder: [], selectedMachineId: null };
  }
  if (action.type === "set-connected") {
    return { ...state, connected: action.connected };
  }
  if (action.type === "select-machine") {
    const machine = state.machines[action.machineId];
    if (!machine) {
      return state;
    }
    const lastIndex = Math.max(0, machine.timelineEntries.length - 1);
    return {
      ...state,
      selectedMachineId: action.machineId,
      machines: {
        ...state.machines,
        [action.machineId]: { ...machine, followLatest: true, selectedTimelineIndex: lastIndex }
      }
    };
  }
  if (action.type === "set-display-limit") {
    return { ...state, displayLimit: action.limit };
  }
  if (action.type === "set-follow-latest") {
    const machine = state.machines[action.machineId];
    if (!machine) {
      return state;
    }
    const lastIndex = Math.max(0, machine.timelineEntries.length - 1);
    return {
      ...state,
      machines: {
        ...state.machines,
        [action.machineId]: {
          ...machine,
          followLatest: action.followLatest,
          selectedTimelineIndex: action.followLatest
            ? lastIndex
            : Math.min(machine.selectedTimelineIndex, lastIndex)
        }
      }
    };
  }
  if (action.type === "select-timeline-entry") {
    const machine = state.machines[action.machineId];
    if (!machine) {
      return state;
    }
    const lastIndex = Math.max(0, machine.timelineEntries.length - 1);
    const safeIndex = Math.max(0, Math.min(action.index, lastIndex));
    return {
      ...state,
      machines: {
        ...state.machines,
        [action.machineId]: { ...machine, selectedTimelineIndex: safeIndex, followLatest: false }
      }
    };
  }
  if (action.type === "prune-timeline") {
    const machine = state.machines[action.machineId];
    if (!machine || action.keep === null) {
      return state;
    }
    return {
      ...state,
      machines: {
        ...state.machines,
        [action.machineId]: pruneTimelineEntries(machine, action.keep)
      }
    };
  }
  if (action.type === "queue-command") {
    const machine = state.machines[action.machineId];
    if (!machine) {
      return state;
    }
    const queuedEntry = buildQueuedTimelineEntry(
      machine,
      action.machineId,
      action.requestId,
      action.invocation,
      action.timestamp
    );
    const machineWithEntry = appendTimelineEntry(machine, queuedEntry);
    return {
      ...state,
      machines: {
        ...state.machines,
        [action.machineId]: {
          ...machineWithEntry,
          pendingCommandsByRequestId: {
            ...machineWithEntry.pendingCommandsByRequestId,
            [action.requestId]: {
              requestId: action.requestId,
              invocation: action.invocation,
              timestamp: action.timestamp,
              timelineEntryId: queuedEntry.id
            }
          }
        }
      }
    };
  }

  const envelope = action.envelope;
  if (envelope.kind === "unregister") {
    const nextOrder = removeJourneyMachineOrder(state.machineOrder, envelope.machineId);
    const nextMachines = { ...state.machines };
    delete nextMachines[envelope.machineId];
    return {
      ...state,
      machines: nextMachines,
      machineOrder: nextOrder,
      selectedMachineId:
        state.selectedMachineId === envelope.machineId
          ? (nextOrder[0] ?? null)
          : state.selectedMachineId
    };
  }

  const existingMachine =
    state.machines[envelope.machineId] ??
    buildJourneyMachineState(envelope.machineId, initialSnapshot, envelope.version);
  const machineWithSnapshot = applyMachineUpdateForEnvelope(existingMachine, envelope);
  const timelineEntry = buildTimelineEntry(machineWithSnapshot, envelope);
  const pending =
    "requestId" in envelope
      ? machineWithSnapshot.pendingCommandsByRequestId[envelope.requestId]
      : null;
  const machineWithEntry =
    envelope.kind === "operationResult" || envelope.kind === "operationError"
      ? replaceTimelineEntry(
          machineWithSnapshot,
          pending?.timelineEntryId ?? "",
          pending
            ? { ...timelineEntry, id: pending.timelineEntryId, timestamp: pending.timestamp }
            : timelineEntry
        )
      : appendTimelineEntry(machineWithSnapshot, timelineEntry);
  const machineWithPendingCleanup =
    envelope.kind === "operationResult" || envelope.kind === "operationError"
      ? {
          ...machineWithEntry,
          pendingCommandsByRequestId: clearPendingCommand(
            machineWithEntry.pendingCommandsByRequestId,
            envelope.requestId
          )
        }
      : machineWithEntry;
  const nextOrder = upsertJourneyMachineOrder(state.machineOrder, envelope.machineId);

  return {
    ...state,
    machines: { ...state.machines, [envelope.machineId]: machineWithPendingCleanup },
    machineOrder: nextOrder,
    selectedMachineId: state.selectedMachineId ?? envelope.machineId
  };
};

export const selectActiveMachine = (state: JourneyPanelState): JourneyPanelMachineState | null =>
  state.selectedMachineId ? (state.machines[state.selectedMachineId] ?? null) : null;

export const selectVisibleTimelineEntries = (
  entries: readonly JourneyPanelTimelineEntry[],
  limit: number | null
): JourneyPanelTimelineEntry[] => {
  if (limit === null) {
    return [...entries];
  }
  const keep = Math.max(0, limit);
  return entries.slice(Math.max(0, entries.length - keep));
};

export const selectSelectedTimelineEntry = (
  machine: JourneyPanelMachineState | null
): JourneyPanelTimelineEntry | null => {
  if (!machine || machine.timelineEntries.length === 0) {
    return null;
  }
  const safeIndex = Math.max(
    0,
    Math.min(machine.selectedTimelineIndex, machine.timelineEntries.length - 1)
  );
  return machine.timelineEntries[safeIndex] ?? null;
};

export const selectDisplayedSnapshot = (
  machine: JourneyPanelMachineState | null
): JourneyDevtoolsSerializableSnapshot | null => {
  if (!machine) {
    return null;
  }
  if (machine.followLatest || machine.timelineEntries.length === 0) {
    return machine.snapshot;
  }
  const safeIndex = Math.max(
    0,
    Math.min(machine.selectedTimelineIndex, machine.timelineEntries.length - 1)
  );
  return resolveSnapshotAtIndex(machine.timelineEntries, safeIndex) ?? machine.snapshot;
};

export const selectSelectedDiff = (
  machine: JourneyPanelMachineState | null
): JourneyPanelStructuredDiff => {
  if (!machine || machine.timelineEntries.length === 0) {
    return EMPTY_STRUCTURED_DIFF;
  }
  const safeIndex = Math.max(
    0,
    Math.min(machine.selectedTimelineIndex, machine.timelineEntries.length - 1)
  );
  const currentEntry = machine.timelineEntries[safeIndex] ?? null;
  const currentSnapshot = resolveSnapshotAtIndex(machine.timelineEntries, safeIndex);
  const previousSnapshot =
    safeIndex > 0 ? resolveSnapshotAtIndex(machine.timelineEntries, safeIndex - 1) : null;

  if (!currentSnapshot || !previousSnapshot) {
    return EMPTY_STRUCTURED_DIFF;
  }

  const immediateDiff = computeStructuredDiff(previousSnapshot, currentSnapshot);
  const immediateDiffIsEmpty =
    Object.keys(immediateDiff.added).length === 0 &&
    Object.keys(immediateDiff.removed).length === 0 &&
    Object.keys(immediateDiff.changed).length === 0;

  if (
    immediateDiffIsEmpty &&
    currentEntry?.envelopeKind === "operationResult" &&
    safeIndex > 1 &&
    machine.timelineEntries[safeIndex - 1]?.envelopeKind === "snapshot"
  ) {
    const snapshotBeforeImmediate = resolveSnapshotAtIndex(machine.timelineEntries, safeIndex - 2);
    if (snapshotBeforeImmediate) {
      return computeStructuredDiff(snapshotBeforeImmediate, currentSnapshot);
    }
  }

  return immediateDiff;
};
