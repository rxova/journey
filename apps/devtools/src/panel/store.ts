import type {
  JourneyDevtoolsBridgeEnvelope,
  JourneyDevtoolsCommand,
  JourneyDevtoolsMachineMeta,
  JourneyDevtoolsSerializableSnapshot
} from "@rxova/journey-devtools-bridge";
import {
  EMPTY_STRUCTURED_DIFF,
  computeStructuredDiff,
  type JourneyPanelStructuredDiff
} from "./diff";

type TimelineEnvelopeKind = Exclude<JourneyDevtoolsBridgeEnvelope["kind"], "unregister">;

export type JourneyPanelTimelineKind = "init" | "snapshot" | "command" | "error";

export type JourneyPanelPendingCommand = {
  requestId: string;
  command: JourneyDevtoolsCommand;
  timestamp: number;
};

export type JourneyPanelTimelineEntry = {
  id: string;
  timestamp: number;
  kind: JourneyPanelTimelineKind;
  label: string;
  requestId: string | null;
  command: JourneyDevtoolsCommand | null;
  envelopeKind: TimelineEnvelopeKind;
  snapshot: JourneyDevtoolsSerializableSnapshot | null;
  actionPayload: unknown;
  meta: {
    machineId: string;
    transitioned?: boolean;
    transitionId?: string;
    errorMessage?: string;
  };
};

export type JourneyPanelMachineState = {
  meta: JourneyDevtoolsMachineMeta;
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
      command: JourneyDevtoolsCommand;
      timestamp: number;
    };

export const MAX_MACHINE_TIMELINE_ENTRIES = 2000;

const initialSnapshot: JourneyDevtoolsSerializableSnapshot = {
  currentStepId: "unknown",
  history: {
    timeline: ["unknown"],
    index: 0
  },
  context: null,
  visited: {},
  stepMeta: {},
  status: "running",
  async: {
    isLoading: false,
    byStep: {}
  }
};

const buildMachineState = (
  machineId: string,
  snapshot: JourneyDevtoolsSerializableSnapshot
): JourneyPanelMachineState => ({
  meta: {
    machineId,
    label: machineId,
    appName: null,
    commandsEnabled: true
  },
  snapshot,
  timelineEntries: [],
  selectedTimelineIndex: 0,
  followLatest: true,
  timelineSequence: 0,
  pendingCommandsByRequestId: {}
});

const buildEntryId = (
  machineId: string,
  envelopeKind: TimelineEnvelopeKind,
  timestamp: number,
  nextSequence: number
): string => `${machineId}-timeline-${envelopeKind}-${timestamp}-${nextSequence}`;

const buildCommandLabel = (
  requestId: string,
  pendingCommand: JourneyPanelPendingCommand | null,
  isError: boolean
): string => {
  if (pendingCommand) {
    const prefix = isError ? "ERROR" : "COMMAND";
    return `${prefix}/${pendingCommand.command.type}`;
  }

  return isError ? `ERROR/${requestId}` : `COMMAND_RESULT/${requestId}`;
};

const buildTimelineEntry = (
  machine: JourneyPanelMachineState,
  envelope: Exclude<JourneyDevtoolsBridgeEnvelope, { kind: "unregister" }>
): JourneyPanelTimelineEntry => {
  const nextSequence = (machine.timelineSequence ?? machine.timelineEntries.length) + 1;

  if (envelope.kind === "register") {
    return {
      id: buildEntryId(envelope.machineId, envelope.kind, envelope.timestamp, nextSequence),
      timestamp: envelope.timestamp,
      kind: "init",
      label: "@@INIT",
      requestId: null,
      command: null,
      envelopeKind: envelope.kind,
      snapshot: envelope.snapshot,
      actionPayload: {
        type: "@@INIT",
        machineId: envelope.machineId,
        meta: envelope.meta
      },
      meta: {
        machineId: envelope.machineId
      }
    };
  }

  if (envelope.kind === "snapshot") {
    const label = `SNAPSHOT/${envelope.snapshot.currentStepId}`;
    return {
      id: buildEntryId(envelope.machineId, envelope.kind, envelope.timestamp, nextSequence),
      timestamp: envelope.timestamp,
      kind: "snapshot",
      label,
      requestId: null,
      command: null,
      envelopeKind: envelope.kind,
      snapshot: envelope.snapshot,
      actionPayload: {
        type: label,
        machineId: envelope.machineId,
        currentStepId: envelope.snapshot.currentStepId,
        index: envelope.snapshot.history.index
      },
      meta: {
        machineId: envelope.machineId
      }
    };
  }

  if (envelope.kind === "commandResult") {
    const pendingCommand = machine.pendingCommandsByRequestId[envelope.requestId] ?? null;
    const label = buildCommandLabel(envelope.requestId, pendingCommand, false);
    return {
      id: buildEntryId(envelope.machineId, envelope.kind, envelope.timestamp, nextSequence),
      timestamp: envelope.timestamp,
      kind: "command",
      label,
      requestId: envelope.requestId,
      command: pendingCommand?.command ?? null,
      envelopeKind: envelope.kind,
      snapshot: envelope.snapshot,
      actionPayload: {
        type: label,
        machineId: envelope.machineId,
        requestId: envelope.requestId,
        command: pendingCommand?.command ?? null,
        transitioned: envelope.transitioned ?? null,
        transitionId: envelope.transitionId ?? null
      },
      meta: {
        machineId: envelope.machineId,
        ...(envelope.transitioned === undefined
          ? {}
          : {
              transitioned: envelope.transitioned
            }),
        ...(envelope.transitionId === undefined
          ? {}
          : {
              transitionId: envelope.transitionId
            })
      }
    };
  }

  const pendingCommand = machine.pendingCommandsByRequestId[envelope.requestId] ?? null;
  const label = buildCommandLabel(envelope.requestId, pendingCommand, true);
  return {
    id: buildEntryId(envelope.machineId, envelope.kind, envelope.timestamp, nextSequence),
    timestamp: envelope.timestamp,
    kind: "error",
    label,
    requestId: envelope.requestId,
    command: pendingCommand?.command ?? null,
    envelopeKind: envelope.kind,
    snapshot: machine.snapshot,
    actionPayload: {
      type: label,
      machineId: envelope.machineId,
      requestId: envelope.requestId,
      command: pendingCommand?.command ?? null,
      error: envelope.error
    },
    meta: {
      machineId: envelope.machineId,
      errorMessage: envelope.error.message
    }
  };
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

const pruneTimelineEntries = (
  machine: JourneyPanelMachineState,
  keep: number
): JourneyPanelMachineState => {
  const safeKeep = Math.max(0, keep);
  if (safeKeep >= machine.timelineEntries.length) {
    return machine;
  }

  const removedCount = machine.timelineEntries.length - safeKeep;
  const nextEntries = machine.timelineEntries.slice(
    Math.max(0, machine.timelineEntries.length - safeKeep)
  );
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

const upsertMachineOrder = (order: string[], machineId: string): string[] => {
  if (order.includes(machineId)) {
    return order;
  }
  return [...order, machineId];
};

const removeMachineOrder = (order: string[], machineId: string): string[] =>
  order.filter((id) => id !== machineId);

const clearPendingCommand = (
  pendingCommandsByRequestId: Record<string, JourneyPanelPendingCommand>,
  requestId: string
): Record<string, JourneyPanelPendingCommand> => {
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
    return {
      ...state,
      machines: {},
      machineOrder: [],
      selectedMachineId: null
    };
  }

  if (action.type === "set-connected") {
    return {
      ...state,
      connected: action.connected
    };
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
        [action.machineId]: {
          ...machine,
          followLatest: true,
          selectedTimelineIndex: lastIndex
        }
      }
    };
  }

  if (action.type === "set-display-limit") {
    return {
      ...state,
      displayLimit: action.limit
    };
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
        [action.machineId]: {
          ...machine,
          selectedTimelineIndex: safeIndex,
          followLatest: false
        }
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

    return {
      ...state,
      machines: {
        ...state.machines,
        [action.machineId]: {
          ...machine,
          pendingCommandsByRequestId: {
            ...machine.pendingCommandsByRequestId,
            [action.requestId]: {
              requestId: action.requestId,
              command: action.command,
              timestamp: action.timestamp
            }
          }
        }
      }
    };
  }

  const envelope = action.envelope;
  if (envelope.kind === "unregister") {
    const nextOrder = removeMachineOrder(state.machineOrder, envelope.machineId);
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
    state.machines[envelope.machineId] ?? buildMachineState(envelope.machineId, initialSnapshot);

  const machineWithSnapshot =
    envelope.kind === "register"
      ? {
          ...existingMachine,
          meta: {
            ...envelope.meta,
            commandsEnabled: envelope.meta.commandsEnabled ?? true
          },
          snapshot: envelope.snapshot
        }
      : envelope.kind === "snapshot"
        ? {
            ...existingMachine,
            snapshot: envelope.snapshot
          }
        : envelope.kind === "commandResult"
          ? {
              ...existingMachine,
              snapshot: envelope.snapshot
            }
          : existingMachine;

  const timelineEntry = buildTimelineEntry(machineWithSnapshot, envelope);
  const machineWithEntry = appendTimelineEntry(machineWithSnapshot, timelineEntry);
  const machineWithPendingCleanup =
    envelope.kind === "commandResult" || envelope.kind === "commandError"
      ? {
          ...machineWithEntry,
          pendingCommandsByRequestId: clearPendingCommand(
            machineWithEntry.pendingCommandsByRequestId,
            envelope.requestId
          )
        }
      : machineWithEntry;
  const nextOrder = upsertMachineOrder(state.machineOrder, envelope.machineId);

  return {
    ...state,
    machines: {
      ...state.machines,
      [envelope.machineId]: machineWithPendingCleanup
    },
    machineOrder: nextOrder,
    selectedMachineId: state.selectedMachineId ?? envelope.machineId
  };
};

export const selectActiveMachine = (state: JourneyPanelState): JourneyPanelMachineState | null => {
  if (!state.selectedMachineId) {
    return null;
  }

  return state.machines[state.selectedMachineId] ?? null;
};

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

  if (machine.followLatest) {
    return machine.snapshot;
  }

  if (machine.timelineEntries.length === 0) {
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

  // Commands often emit a snapshot row before commandResult with identical state.
  // In that case, compare commandResult against the snapshot before that row.
  if (
    immediateDiffIsEmpty &&
    currentEntry?.envelopeKind === "commandResult" &&
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
