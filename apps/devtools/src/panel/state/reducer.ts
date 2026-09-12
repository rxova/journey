import type { JourneyPanelAction, JourneyPanelState } from "./types";
import { INITIAL_SNAPSHOT } from "./types";
import {
  appendTimelineEntry,
  applyMachineUpdateForEnvelope,
  buildJourneyMachineState,
  buildQueuedTimelineEntry,
  buildTimelineEntry,
  clearPendingCommand,
  pruneTimelineEntries,
  removeJourneyMachineOrder,
  replaceTimelineEntry,
  upsertJourneyMachineOrder
} from "./timeline";

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
  switch (action.type) {
    case "clear-machines":
      return { ...state, machines: {}, machineOrder: [], selectedMachineId: null };
    case "set-connected":
      return { ...state, connected: action.connected };
    case "select-machine": {
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
    case "set-display-limit":
      return { ...state, displayLimit: action.limit };
    case "set-follow-latest": {
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
    case "select-timeline-entry": {
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
    case "prune-timeline": {
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
    case "queue-command": {
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
    case "bridge-envelope": {
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
        buildJourneyMachineState(envelope.machineId, INITIAL_SNAPSHOT, envelope.version);
      const pending =
        "requestId" in envelope
          ? existingMachine.pendingCommandsByRequestId[envelope.requestId]
          : null;
      const hasPostCommandSnapshot =
        envelope.kind === "operationResult" &&
        envelope.result.kind === "snapshot" &&
        pending != null &&
        existingMachine.timelineEntries.some(
          (entry) => entry.envelopeKind === "snapshot" && entry.timestamp > pending.timestamp
        );
      const machineWithSnapshot = applyMachineUpdateForEnvelope(existingMachine, envelope, {
        applyOperationResultSnapshot: !hasPostCommandSnapshot
      });
      const timelineEntry = buildTimelineEntry(machineWithSnapshot, envelope);
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
    }
  }
};
