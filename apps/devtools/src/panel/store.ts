import type {
  JourneyDevtoolsBridgeEnvelope,
  JourneyDevtoolsMachineMeta,
  JourneyDevtoolsSerializableSnapshot
} from "@rxova/journey-devtools-bridge";

export type JourneyPanelLogEntry = {
  id: string;
  timestamp: number;
  kind: JourneyDevtoolsBridgeEnvelope["kind"];
  summary: string;
};

export type JourneyPanelMachineState = {
  meta: JourneyDevtoolsMachineMeta;
  snapshot: JourneyDevtoolsSerializableSnapshot;
  logs: JourneyPanelLogEntry[];
  logSequence?: number;
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
  | { type: "bridge-envelope"; envelope: JourneyDevtoolsBridgeEnvelope }
  | { type: "select-machine"; machineId: string }
  | { type: "set-display-limit"; limit: number | null }
  | { type: "prune-logs"; machineId: string; keep: number | null };

type LoggedEnvelope = Exclude<JourneyDevtoolsBridgeEnvelope, { kind: "unregister" }>;
export const MAX_MACHINE_LOGS = 2000;

const initialSnapshot: JourneyDevtoolsSerializableSnapshot = {
  current: "unknown",
  context: null,
  history: [],
  visited: [],
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
  logs: [],
  logSequence: 0
});

const buildLogSummary = (envelope: LoggedEnvelope): string => {
  switch (envelope.kind) {
    case "register":
      return `Registered: ${envelope.meta.label}`;
    case "snapshot":
      return `Snapshot: ${envelope.snapshot.current}`;
    case "commandResult":
      return `Command ${envelope.requestId} succeeded`;
    case "commandError":
      return `Command ${envelope.requestId} failed: ${envelope.error.message}`;
  }
};

const appendEnvelopeLog = (
  machine: JourneyPanelMachineState,
  envelope: LoggedEnvelope
): JourneyPanelMachineState => {
  const nextSequence = (machine.logSequence ?? machine.logs.length) + 1;
  const logEntry: JourneyPanelLogEntry = {
    id: `${envelope.machineId}-${envelope.kind}-${envelope.timestamp}-${nextSequence}`,
    timestamp: envelope.timestamp,
    kind: envelope.kind,
    summary: buildLogSummary(envelope)
  };
  const nextLogs = [...machine.logs, logEntry];

  return {
    ...machine,
    logs: nextLogs.slice(Math.max(0, nextLogs.length - MAX_MACHINE_LOGS)),
    logSequence: nextSequence
  };
};

export const createInitialPanelState = (): JourneyPanelState => ({
  connected: false,
  machines: {},
  machineOrder: [],
  selectedMachineId: null,
  displayLimit: null
});

const upsertMachineOrder = (order: string[], machineId: string): string[] => {
  if (order.includes(machineId)) {
    return order;
  }
  return [...order, machineId];
};

const removeMachineOrder = (order: string[], machineId: string): string[] =>
  order.filter((id) => id !== machineId);

export const panelReducer = (
  state: JourneyPanelState,
  action: JourneyPanelAction
): JourneyPanelState => {
  if (action.type === "set-connected") {
    return {
      ...state,
      connected: action.connected
    };
  }

  if (action.type === "select-machine") {
    if (!(action.machineId in state.machines)) {
      return state;
    }

    return {
      ...state,
      selectedMachineId: action.machineId
    };
  }

  if (action.type === "set-display-limit") {
    return {
      ...state,
      displayLimit: action.limit
    };
  }

  if (action.type === "prune-logs") {
    const machine = state.machines[action.machineId];
    if (!machine || action.keep === null) {
      return state;
    }

    const keep = Math.max(0, action.keep);
    return {
      ...state,
      machines: {
        ...state.machines,
        [action.machineId]: {
          ...machine,
          logs: machine.logs.slice(Math.max(0, machine.logs.length - keep))
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

  const machineWithUpdate =
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

  const withLog = appendEnvelopeLog(machineWithUpdate, envelope);
  const nextOrder = upsertMachineOrder(state.machineOrder, envelope.machineId);

  return {
    ...state,
    machines: {
      ...state.machines,
      [envelope.machineId]: withLog
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

export const selectVisibleLogs = (
  logs: readonly JourneyPanelLogEntry[],
  limit: number | null
): JourneyPanelLogEntry[] => {
  if (limit === null) {
    return [...logs];
  }

  const keep = Math.max(0, limit);
  return logs.slice(Math.max(0, logs.length - keep));
};
