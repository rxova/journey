import { describe, expect, it } from "vitest";

import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  type JourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsMachineCapabilities,
  type JourneyDevtoolsSerializableSnapshot
} from "@rxova/journey-devtools-bridge";
import { EMPTY_STRUCTURED_DIFF } from "../src/panel/diff";
import {
  MAX_MACHINE_TIMELINE_ENTRIES,
  applyMachineUpdateForEnvelope,
  createInitialPanelState,
  panelReducer,
  selectActiveMachine,
  selectDisplayedSnapshot,
  selectSelectedDiff,
  selectSelectedTimelineEntry,
  selectVisibleTimelineEntries,
  type JourneyPanelMachineState
} from "../src/panel/store";

type RegisterEnvelope = Extract<JourneyDevtoolsBridgeEnvelope, { kind: "register" }>;
type SnapshotEnvelope = Extract<JourneyDevtoolsBridgeEnvelope, { kind: "snapshot" }>;
type CommandResultEnvelope = Extract<JourneyDevtoolsBridgeEnvelope, { kind: "commandResult" }>;
type CommandErrorEnvelope = Extract<JourneyDevtoolsBridgeEnvelope, { kind: "commandError" }>;
type ObservationEnvelope = Extract<JourneyDevtoolsBridgeEnvelope, { kind: "observation" }>;
type ExecutionPathsResultEnvelope = Extract<
  JourneyDevtoolsBridgeEnvelope,
  { kind: "executionPathsResult" }
>;

const baseSnapshot = (
  current: string,
  context: JourneyDevtoolsSerializableSnapshot["context"] = { count: current.length }
): JourneyDevtoolsSerializableSnapshot => ({
  currentStepId: current,
  history: {
    timeline: current === "start" ? ["start"] : ["start", current],
    index: current === "start" ? 0 : 1
  },
  context,
  visited: current === "start" ? { start: true } : { start: true, [current]: true },
  status: "running",
  async: {
    isLoading: false,
    byStep: {
      start: { phase: "idle", eventType: null, transitionId: null, error: null }
    }
  }
});

let cursor = 0;
const nextTs = (): number => {
  cursor += 1;
  return 1000 + cursor;
};

const defaultCapabilities: JourneyDevtoolsMachineCapabilities = {
  commands: [
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
  ],
  observe: true as const,
  executionPaths: true
};

const registerEnvelope = (machineId: string, label: string): RegisterEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "register",
  machineId,
  meta: {
    machineId,
    label,
    appName: "Test App",
    capabilities: defaultCapabilities
  },
  snapshot: baseSnapshot("start"),
  timestamp: nextTs()
});

const legacyRegisterEnvelope = (
  machineId: string,
  label: string,
  commandsEnabled = true
): RegisterEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "register",
  machineId,
  meta: {
    machineId,
    label,
    appName: "Legacy App",
    commandsEnabled
  },
  snapshot: baseSnapshot("start"),
  timestamp: nextTs()
});

const snapshotEnvelope = (
  machineId: string,
  current: string,
  context?: JourneyDevtoolsSerializableSnapshot["context"]
): SnapshotEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "snapshot",
  machineId,
  snapshot: baseSnapshot(current, context),
  timestamp: nextTs()
});

const commandResultEnvelope = (
  machineId: string,
  requestId: string,
  current: string
): CommandResultEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "commandResult",
  machineId,
  requestId,
  snapshot: baseSnapshot(current),
  transitioned: true,
  transitionId: "goToNextStep",
  timestamp: nextTs()
});

const commandResultEnvelopeWithoutTransitionMeta = (
  machineId: string,
  requestId: string,
  current: string
): CommandResultEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "commandResult",
  machineId,
  requestId,
  snapshot: baseSnapshot(current),
  timestamp: nextTs()
});

const commandErrorEnvelope = (machineId: string, requestId: string): CommandErrorEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "commandError",
  machineId,
  requestId,
  error: {
    name: "Error",
    message: "boom",
    stack: null,
    cause: null
  },
  timestamp: nextTs()
});

const observationEnvelope = (
  machineId: string,
  eventType: "journey.start"
): ObservationEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "observation",
  machineId,
  event: {
    type: eventType,
    stepId: "start",
    timestamp: nextTs()
  },
  timestamp: nextTs()
});

const executionPathsResultEnvelope = (
  machineId: string,
  requestId: string
): ExecutionPathsResultEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "executionPathsResult",
  machineId,
  requestId,
  result: {
    paths: [
      {
        steps: ["start", "review"],
        events: ["goToNextStep"],
        terminated: "final"
      }
    ],
    truncated: false,
    cyclesDetected: false
  },
  timestamp: nextTs()
});

const unregisterEnvelope = (machineId: string): JourneyDevtoolsBridgeEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "unregister",
  machineId,
  timestamp: nextTs()
});

const createMachineState = (machineId = "machine-1"): JourneyPanelMachineState => ({
  meta: {
    machineId,
    label: "Existing Flow",
    appName: "Existing App",
    commandsEnabled: true,
    capabilities: defaultCapabilities
  },
  protocolVersion: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  snapshot: baseSnapshot("start"),
  timelineEntries: [],
  selectedTimelineIndex: 0,
  followLatest: true,
  timelineSequence: 0,
  pendingCommandsByRequestId: {}
});

describe("applyMachineUpdateForEnvelope", () => {
  it("normalizes register metadata and updates snapshot/protocol version", () => {
    const machine = createMachineState("legacy");
    const updated = applyMachineUpdateForEnvelope(
      machine,
      legacyRegisterEnvelope("legacy", "Legacy Flow", false)
    );

    expect(updated).not.toBe(machine);
    expect(updated.protocolVersion).toBe(JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION);
    expect(updated.snapshot.currentStepId).toBe("start");
    expect(updated.meta).toEqual({
      machineId: "legacy",
      label: "Legacy Flow",
      appName: "Legacy App",
      commandsEnabled: false,
      capabilities: {
        commands: [],
        observe: false,
        executionPaths: false
      }
    });
  });

  it("updates snapshot for snapshot and commandResult envelopes", () => {
    const machine = createMachineState("machine-1");

    const fromSnapshot = applyMachineUpdateForEnvelope(
      machine,
      snapshotEnvelope("machine-1", "review")
    );
    expect(fromSnapshot.protocolVersion).toBe(JOURNEY_DEVTOOLS_PROTOCOL_VERSION);
    expect(fromSnapshot.snapshot.currentStepId).toBe("review");
    expect(fromSnapshot.meta).toBe(machine.meta);

    const fromCommandResult = applyMachineUpdateForEnvelope(
      machine,
      commandResultEnvelope("machine-1", "req-1", "details")
    );
    expect(fromCommandResult.protocolVersion).toBe(JOURNEY_DEVTOOLS_PROTOCOL_VERSION);
    expect(fromCommandResult.snapshot.currentStepId).toBe("details");
    expect(fromCommandResult.meta).toBe(machine.meta);
  });

  it("keeps the machine unchanged for observation, commandError, and executionPathsResult", () => {
    const machine = createMachineState("machine-1");

    expect(
      applyMachineUpdateForEnvelope(machine, observationEnvelope("machine-1", "journey.start"))
    ).toBe(machine);
    expect(applyMachineUpdateForEnvelope(machine, commandErrorEnvelope("machine-1", "req-2"))).toBe(
      machine
    );
    expect(
      applyMachineUpdateForEnvelope(machine, executionPathsResultEnvelope("machine-1", "req-3"))
    ).toBe(machine);
  });
});

describe("panelReducer", () => {
  it("builds expected initial state", () => {
    const state = createInitialPanelState();
    expect(state).toEqual({
      connected: false,
      machines: {},
      machineOrder: [],
      selectedMachineId: null,
      displayLimit: null
    });
  });

  it("updates connection state", () => {
    const next = panelReducer(createInitialPanelState(), {
      type: "set-connected",
      connected: true
    });
    expect(next.connected).toBe(true);
  });

  it("clear-machines removes timeline state while keeping connection and display settings", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "set-connected",
      connected: true
    });
    state = panelReducer(state, {
      type: "set-display-limit",
      limit: 25
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });

    const cleared = panelReducer(state, { type: "clear-machines" });
    expect(cleared.connected).toBe(true);
    expect(cleared.displayLimit).toBe(25);
    expect(cleared.machines).toEqual({});
    expect(cleared.machineOrder).toEqual([]);
    expect(cleared.selectedMachineId).toBeNull();
  });

  it("keeps same state when selecting unknown machine", () => {
    const initial = createInitialPanelState();
    const next = panelReducer(initial, { type: "select-machine", machineId: "missing" });
    expect(next).toBe(initial);
  });

  it("registers first machine and appends @@INIT row", () => {
    const next = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });

    expect(next.machineOrder).toEqual(["a"]);
    expect(next.selectedMachineId).toBe("a");
    expect(next.machines.a?.timelineEntries).toHaveLength(1);
    expect(next.machines.a?.timelineEntries[0]?.label).toBe("@@INIT");
    expect(next.machines.a?.followLatest).toBe(true);
  });

  it("normalizes legacy v3 machine metadata and preserves protocol version", () => {
    const next = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: legacyRegisterEnvelope("legacy", "Legacy Flow")
    });

    expect(next.machines.legacy?.protocolVersion).toBe(JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION);
    expect(next.machines.legacy?.meta.capabilities).toEqual({
      commands: [
        "goToNextStep",
        "terminateJourney",
        "completeJourney",
        "goToStepById",
        "goToPreviousStep",
        "goToLastVisitedStep",
        "send",
        "resetJourney",
        "clearStepError"
      ],
      observe: false,
      executionPaths: false
    });
  });

  it("preserves selected machine when a second one registers", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: registerEnvelope("b", "Flow B")
    });

    expect(state.machineOrder).toEqual(["a", "b"]);
    expect(state.selectedMachineId).toBe("a");
  });

  it("select-machine moves machine back to follow-latest mode", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: snapshotEnvelope("a", "review")
    });
    state = panelReducer(state, {
      type: "select-timeline-entry",
      machineId: "a",
      index: 0
    });
    expect(state.machines.a?.followLatest).toBe(false);

    state = panelReducer(state, {
      type: "select-machine",
      machineId: "a"
    });
    expect(state.machines.a?.followLatest).toBe(true);
    expect(state.machines.a?.selectedTimelineIndex).toBe(1);
  });

  it("uses synthetic label for snapshot rows", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: snapshotEnvelope("a", "review")
    });

    const last =
      state.machines.a?.timelineEntries[(state.machines.a?.timelineEntries.length ?? 1) - 1];
    expect(last?.label).toBe("SNAPSHOT/review");
    expect(last?.kind).toBe("snapshot");
  });

  it("correlates queued commands with commandResult rows", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });

    state = panelReducer(state, {
      type: "queue-command",
      machineId: "a",
      requestId: "req-1",
      command: { type: "goToNextStep" },
      timestamp: nextTs()
    });

    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: commandResultEnvelope("a", "req-1", "details")
    });

    const last =
      state.machines.a?.timelineEntries[(state.machines.a?.timelineEntries.length ?? 1) - 1];
    expect(last?.label).toBe("COMMAND/goToNextStep");
    expect(last?.command).toEqual({ type: "goToNextStep" });
    expect(state.machines.a?.pendingCommandsByRequestId["req-1"]).toBeUndefined();
  });

  it("falls back when commandResult has unknown requestId", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: commandResultEnvelope("a", "missing", "details")
    });

    const last =
      state.machines.a?.timelineEntries[(state.machines.a?.timelineEntries.length ?? 1) - 1];
    expect(last?.label).toBe("COMMAND_RESULT/missing");
  });

  it("omits transition metadata when commandResult does not include it", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: commandResultEnvelopeWithoutTransitionMeta("a", "req-no-meta", "details")
    });

    const last =
      state.machines.a?.timelineEntries[(state.machines.a?.timelineEntries.length ?? 1) - 1];
    expect(last?.meta.transitioned).toBeUndefined();
    expect(last?.meta.transitionId).toBeUndefined();
  });

  it("correlates queued commands with commandError rows", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    const beforeSnapshot = state.machines.a?.snapshot;

    state = panelReducer(state, {
      type: "queue-command",
      machineId: "a",
      requestId: "req-2",
      command: { type: "goToStepById", stepId: "review" },
      timestamp: nextTs()
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: commandErrorEnvelope("a", "req-2")
    });

    const last =
      state.machines.a?.timelineEntries[(state.machines.a?.timelineEntries.length ?? 1) - 1];
    expect(last?.label).toBe("ERROR/goToStepById");
    expect(last?.snapshot).toBeNull();
    expect(last?.kind).toBe("error");
    expect(selectDisplayedSnapshot(state.machines.a ?? null)).toEqual(beforeSnapshot);
    expect(state.machines.a?.pendingCommandsByRequestId["req-2"]).toBeUndefined();
  });

  it("falls back when commandError has unknown requestId", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: commandErrorEnvelope("a", "missing-error")
    });

    const last =
      state.machines.a?.timelineEntries[(state.machines.a?.timelineEntries.length ?? 1) - 1];
    expect(last?.label).toBe("ERROR/missing-error");
    expect(last?.command).toBeNull();
    expect((last?.actionPayload as { command: unknown }).command).toBeNull();
  });

  it("adds observation and execution-path query rows without changing the latest snapshot", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });

    state = panelReducer(state, {
      type: "queue-command",
      machineId: "a",
      requestId: "req-paths",
      command: { type: "getExecutionPaths", options: { maxDepth: 3 } },
      timestamp: nextTs()
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: observationEnvelope("a", "journey.start")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: executionPathsResultEnvelope("a", "req-paths")
    });

    const entries = state.machines.a?.timelineEntries ?? [];
    const observation = entries[entries.length - 2];
    const query = entries[entries.length - 1];

    expect(observation?.label).toBe("EVENT/journey.start");
    expect(observation?.kind).toBe("event");
    expect(observation?.snapshot).toBeNull();

    expect(query?.label).toBe("QUERY/getExecutionPaths");
    expect(query?.kind).toBe("query");
    expect(query?.snapshot).toBeNull();
    expect(state.machines.a?.pendingCommandsByRequestId["req-paths"]).toBeUndefined();
    expect(selectDisplayedSnapshot(state.machines.a ?? null)?.currentStepId).toBe("start");
  });

  it("unregister removes machine and selects first remaining", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: registerEnvelope("b", "Flow B")
    });
    state = panelReducer(state, { type: "select-machine", machineId: "b" });

    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: unregisterEnvelope("b")
    });

    expect(state.machineOrder).toEqual(["a"]);
    expect(state.selectedMachineId).toBe("a");
    expect(state.machines.b).toBeUndefined();
  });

  it("keeps selectedMachineId when unregistering a different machine", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: registerEnvelope("b", "Flow B")
    });
    state = panelReducer(state, { type: "select-machine", machineId: "a" });

    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: unregisterEnvelope("b")
    });

    expect(state.selectedMachineId).toBe("a");
  });

  it("unregister clears selected machine when the last machine is removed", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });

    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: unregisterEnvelope("a")
    });

    expect(state.machineOrder).toEqual([]);
    expect(state.selectedMachineId).toBeNull();
    expect(state.machines.a).toBeUndefined();
  });

  it("updates display limit and prunes timeline entries", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: snapshotEnvelope("a", "details")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: snapshotEnvelope("a", "review")
    });

    state = panelReducer(state, { type: "set-display-limit", limit: 2 });
    state = panelReducer(state, { type: "prune-timeline", machineId: "a", keep: 2 });

    expect(state.displayLimit).toBe(2);
    expect(state.machines.a?.timelineEntries).toHaveLength(2);
  });

  it("does not change machine reference when prune keep is larger than history", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: snapshotEnvelope("a", "details")
    });

    const machineBefore = state.machines.a;
    state = panelReducer(state, { type: "prune-timeline", machineId: "a", keep: 99 });
    expect(state.machines.a).toBe(machineBefore);
  });

  it("keeps state for prune requests on missing machine or null keep", () => {
    const state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });

    const unchangedForMissing = panelReducer(state, {
      type: "prune-timeline",
      machineId: "missing",
      keep: 5
    });
    const unchangedForNull = panelReducer(state, {
      type: "prune-timeline",
      machineId: "a",
      keep: null
    });

    expect(unchangedForMissing).toBe(state);
    expect(unchangedForNull).toBe(state);
  });

  it("clamps negative keep values to zero during prune", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: snapshotEnvelope("a", "details")
    });
    state = panelReducer(state, {
      type: "prune-timeline",
      machineId: "a",
      keep: -10
    });

    expect(state.machines.a?.timelineEntries).toHaveLength(0);
  });

  it("uses unique row ids even when envelopes share same timestamp", () => {
    const fixedTimestamp = 7777;
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: {
        ...registerEnvelope("a", "Flow A"),
        timestamp: fixedTimestamp
      }
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: {
        ...snapshotEnvelope("a", "review"),
        timestamp: fixedTimestamp
      }
    });

    const ids = (state.machines.a?.timelineEntries ?? []).map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("supports legacy machine records missing timelineSequence", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    const machine = state.machines.a;
    if (!machine) {
      throw new Error("expected machine a");
    }

    const legacyMachine = { ...machine };
    delete (legacyMachine as { timelineSequence?: number }).timelineSequence;
    state = {
      ...state,
      machines: {
        ...state.machines,
        a: legacyMachine
      }
    };

    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: snapshotEnvelope("a", "legacy")
    });

    expect(state.machines.a?.timelineSequence).toBe(2);
    expect(state.machines.a?.timelineEntries[1]?.label).toBe("SNAPSHOT/legacy");
  });

  it("retains only the latest cap of timeline entries per machine", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("cap", "Flow Cap")
    });

    for (let index = 0; index < MAX_MACHINE_TIMELINE_ENTRIES + 500; index += 1) {
      state = panelReducer(state, {
        type: "bridge-envelope",
        envelope: snapshotEnvelope("cap", `step-${index}`)
      });
    }

    const entries = state.machines.cap?.timelineEntries ?? [];
    expect(entries).toHaveLength(MAX_MACHINE_TIMELINE_ENTRIES);
    expect(entries[0]?.label).toContain("step-500");
    expect(entries[MAX_MACHINE_TIMELINE_ENTRIES - 1]?.label).toContain(
      `step-${MAX_MACHINE_TIMELINE_ENTRIES + 499}`
    );
  });

  it("set-follow-latest no-ops when machine is missing", () => {
    const state = createInitialPanelState();
    const next = panelReducer(state, {
      type: "set-follow-latest",
      machineId: "missing",
      followLatest: true
    });
    expect(next).toBe(state);
  });

  it("queue-command no-ops when machine is missing", () => {
    const state = createInitialPanelState();
    const next = panelReducer(state, {
      type: "queue-command",
      machineId: "missing",
      requestId: "req-missing",
      command: { type: "goToNextStep" },
      timestamp: nextTs()
    });
    expect(next).toBe(state);
  });

  it("toggles follow-latest and keeps selected row bounded", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: snapshotEnvelope("a", "details")
    });
    state = panelReducer(state, {
      type: "select-timeline-entry",
      machineId: "a",
      index: 0
    });
    expect(state.machines.a?.followLatest).toBe(false);
    expect(state.machines.a?.selectedTimelineIndex).toBe(0);

    state = panelReducer(state, {
      type: "set-follow-latest",
      machineId: "a",
      followLatest: true
    });
    expect(state.machines.a?.followLatest).toBe(true);
    expect(state.machines.a?.selectedTimelineIndex).toBe(1);
  });

  it("select-timeline-entry clamps indexes and no-ops for missing machine", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: snapshotEnvelope("a", "details")
    });

    const unchanged = panelReducer(state, {
      type: "select-timeline-entry",
      machineId: "missing",
      index: 5
    });
    expect(unchanged).toBe(state);

    state = panelReducer(state, {
      type: "select-timeline-entry",
      machineId: "a",
      index: 999
    });
    expect(state.machines.a?.selectedTimelineIndex).toBe(1);
    expect(state.machines.a?.followLatest).toBe(false);

    state = panelReducer(state, {
      type: "select-timeline-entry",
      machineId: "a",
      index: -2
    });
    expect(state.machines.a?.selectedTimelineIndex).toBe(0);
  });
});

describe("selectors", () => {
  it("selectActiveMachine returns null when no selected machine", () => {
    expect(selectActiveMachine(createInitialPanelState())).toBeNull();
  });

  it("selectActiveMachine resolves current selected machine", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: registerEnvelope("b", "Flow B")
    });
    state = panelReducer(state, { type: "select-machine", machineId: "b" });

    expect(selectActiveMachine(state)?.meta.machineId).toBe("b");
  });

  it("selectActiveMachine returns null when selected id has no machine entry", () => {
    const state = {
      ...createInitialPanelState(),
      selectedMachineId: "missing"
    };
    expect(selectActiveMachine(state)).toBeNull();
  });

  it("selectVisibleTimelineEntries returns full copy when limit is null", () => {
    const entries = [
      {
        id: "1",
        timestamp: 1,
        kind: "snapshot" as const,
        label: "SNAPSHOT/a",
        requestId: null,
        command: null,
        envelopeKind: "snapshot" as const,
        snapshot: baseSnapshot("a"),
        actionPayload: {},
        meta: { machineId: "a" }
      },
      {
        id: "2",
        timestamp: 2,
        kind: "snapshot" as const,
        label: "SNAPSHOT/b",
        requestId: null,
        command: null,
        envelopeKind: "snapshot" as const,
        snapshot: baseSnapshot("b"),
        actionPayload: {},
        meta: { machineId: "a" }
      }
    ];

    const visible = selectVisibleTimelineEntries(entries, null);
    expect(visible).toEqual(entries);
    expect(visible).not.toBe(entries);
  });

  it("selectVisibleTimelineEntries respects positive and negative limits", () => {
    const entries = [
      {
        id: "1",
        timestamp: 1,
        kind: "snapshot" as const,
        label: "SNAPSHOT/one",
        requestId: null,
        command: null,
        envelopeKind: "snapshot" as const,
        snapshot: baseSnapshot("one"),
        actionPayload: {},
        meta: { machineId: "a" }
      },
      {
        id: "2",
        timestamp: 2,
        kind: "snapshot" as const,
        label: "SNAPSHOT/two",
        requestId: null,
        command: null,
        envelopeKind: "snapshot" as const,
        snapshot: baseSnapshot("two"),
        actionPayload: {},
        meta: { machineId: "a" }
      },
      {
        id: "3",
        timestamp: 3,
        kind: "snapshot" as const,
        label: "SNAPSHOT/three",
        requestId: null,
        command: null,
        envelopeKind: "snapshot" as const,
        snapshot: baseSnapshot("three"),
        actionPayload: {},
        meta: { machineId: "a" }
      }
    ];

    expect(selectVisibleTimelineEntries(entries, 2).map((entry) => entry.id)).toEqual(["2", "3"]);
    expect(selectVisibleTimelineEntries(entries, -2)).toEqual([]);
  });

  it("selectSelectedTimelineEntry returns selected row and handles empty machine", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: snapshotEnvelope("a", "review")
    });
    state = panelReducer(state, {
      type: "select-timeline-entry",
      machineId: "a",
      index: 0
    });

    expect(selectSelectedTimelineEntry(state.machines.a ?? null)?.label).toBe("@@INIT");
    expect(selectSelectedTimelineEntry(null)).toBeNull();
  });

  it("selectSelectedTimelineEntry returns null for sparse timeline slots", () => {
    const machine = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    }).machines.a;
    if (!machine) {
      throw new Error("expected machine a");
    }

    const sparseEntries = [...machine.timelineEntries];
    delete sparseEntries[0];
    const sparseMachine = {
      ...machine,
      timelineEntries: sparseEntries as typeof machine.timelineEntries,
      selectedTimelineIndex: 0
    };

    expect(selectSelectedTimelineEntry(sparseMachine)).toBeNull();
  });

  it("selectDisplayedSnapshot uses latest for follow mode and selected row for inspect mode", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: snapshotEnvelope("a", "details")
    });

    expect(selectDisplayedSnapshot(state.machines.a ?? null)?.currentStepId).toBe("details");

    state = panelReducer(state, {
      type: "select-timeline-entry",
      machineId: "a",
      index: 0
    });
    expect(selectDisplayedSnapshot(state.machines.a ?? null)?.currentStepId).toBe("start");
    expect(selectDisplayedSnapshot(null)).toBeNull();
  });

  it("selectDisplayedSnapshot returns machine snapshot when inspect mode has no rows", () => {
    const machine = {
      meta: {
        machineId: "m-empty",
        label: "Empty",
        appName: null,
        commandsEnabled: true,
        capabilities: defaultCapabilities
      },
      snapshot: baseSnapshot("start"),
      timelineEntries: [],
      selectedTimelineIndex: 0,
      followLatest: false,
      pendingCommandsByRequestId: {}
    };

    expect(selectDisplayedSnapshot(machine)?.currentStepId).toBe("start");
  });

  it("selectDisplayedSnapshot falls back when inspect selection has no snapshots", () => {
    const machine = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    }).machines.a;
    if (!machine) {
      throw new Error("expected machine a");
    }
    const initEntry = machine.timelineEntries[0];
    if (!initEntry) {
      throw new Error("expected init timeline entry");
    }

    const nullSnapshotEntries = [
      {
        ...initEntry,
        snapshot: null
      },
      {
        ...initEntry,
        id: "a-command-null-snapshot",
        kind: "command" as const,
        label: "COMMAND_RESULT/missing",
        requestId: "missing",
        command: null,
        envelopeKind: "commandResult" as const,
        snapshot: null,
        actionPayload: { type: "COMMAND_RESULT/missing" },
        meta: { machineId: "a" }
      }
    ];

    const inspectMachine = {
      ...machine,
      followLatest: false,
      selectedTimelineIndex: 1,
      timelineEntries: nullSnapshotEntries
    };
    expect(selectDisplayedSnapshot(inspectMachine)?.currentStepId).toBe("start");
  });

  it("selectSelectedDiff returns deterministic path diff", () => {
    const contextA = {
      user: {
        name: "Ava",
        age: 30
      },
      flags: ["a", "b"]
    };
    const contextB = {
      user: {
        name: "Ava",
        age: 31
      },
      flags: ["a", "b", "c"],
      metadata: {
        region: "us"
      }
    };

    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: snapshotEnvelope("a", "details", contextA)
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: snapshotEnvelope("a", "review", contextB)
    });
    state = panelReducer(state, {
      type: "select-timeline-entry",
      machineId: "a",
      index: 2
    });

    const diff = selectSelectedDiff(state.machines.a ?? null);
    expect(diff.changed["context.user.age"]).toEqual({ before: 30, after: 31 });
    expect(diff.added["context.flags[2]"]).toBe("c");
    expect(diff.added["context.metadata"]).toEqual({ region: "us" });
  });

  it("selectSelectedDiff skips duplicate snapshot before commandResult", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: snapshotEnvelope("a", "details")
    });
    state = panelReducer(state, {
      type: "queue-command",
      machineId: "a",
      requestId: "req-dup",
      command: { type: "goToNextStep" },
      timestamp: nextTs()
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: commandResultEnvelope("a", "req-dup", "details")
    });

    const machine = state.machines.a;
    if (!machine) {
      throw new Error("expected machine a");
    }

    const diff = selectSelectedDiff(machine);
    expect(diff.changed.currentStepId).toEqual({ before: "start", after: "details" });
  });

  it("selectSelectedDiff stays empty for no-op commandResult without intermediate snapshot", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    state = panelReducer(state, {
      type: "queue-command",
      machineId: "a",
      requestId: "req-noop",
      command: { type: "goToNextStep" },
      timestamp: nextTs()
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: commandResultEnvelope("a", "req-noop", "start")
    });

    expect(selectSelectedDiff(state.machines.a ?? null)).toEqual(EMPTY_STRUCTURED_DIFF);
  });

  it("selectSelectedDiff returns empty diff when no previous snapshot exists", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    state = panelReducer(state, {
      type: "select-timeline-entry",
      machineId: "a",
      index: 0
    });

    expect(selectSelectedDiff(state.machines.a ?? null)).toEqual(EMPTY_STRUCTURED_DIFF);
    expect(selectSelectedDiff(null)).toEqual(EMPTY_STRUCTURED_DIFF);
  });

  it("selectSelectedDiff returns empty diff when selected entries cannot resolve snapshots", () => {
    const machine = {
      meta: {
        machineId: "m-diff",
        label: "Diff",
        appName: null,
        commandsEnabled: true,
        capabilities: defaultCapabilities
      },
      snapshot: baseSnapshot("start"),
      timelineEntries: [
        {
          id: "row-1",
          timestamp: 1,
          kind: "command" as const,
          label: "COMMAND/goToNextStep",
          requestId: "req-1",
          command: { type: "goToNextStep" as const },
          envelopeKind: "commandResult" as const,
          snapshot: null,
          actionPayload: {},
          meta: { machineId: "m-diff" }
        }
      ],
      selectedTimelineIndex: 0,
      followLatest: false,
      pendingCommandsByRequestId: {}
    };

    expect(selectSelectedDiff(machine)).toEqual(EMPTY_STRUCTURED_DIFF);
  });

  it("selectSelectedDiff returns empty diff for sparse selected entries", () => {
    const machine = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    }).machines.a;
    if (!machine) {
      throw new Error("expected machine a");
    }

    const sparseEntries = [...machine.timelineEntries];
    delete sparseEntries[0];

    expect(
      selectSelectedDiff({
        ...machine,
        timelineEntries: sparseEntries as typeof machine.timelineEntries,
        followLatest: false,
        selectedTimelineIndex: 0
      })
    ).toEqual(EMPTY_STRUCTURED_DIFF);
  });

  it("selectSelectedDiff stays empty when duplicate command results have no earlier resolvable snapshot", () => {
    const reviewSnapshot = baseSnapshot("review");
    const machine = {
      meta: {
        machineId: "m-diff-gap",
        label: "Diff Gap",
        appName: null,
        commandsEnabled: true,
        capabilities: defaultCapabilities
      },
      snapshot: reviewSnapshot,
      timelineEntries: [
        {
          id: "row-null-snapshot",
          timestamp: 1,
          kind: "snapshot" as const,
          label: "SNAPSHOT/missing",
          requestId: null,
          command: null,
          envelopeKind: "snapshot" as const,
          snapshot: null,
          actionPayload: {},
          meta: { machineId: "m-diff-gap" }
        },
        {
          id: "row-review-snapshot",
          timestamp: 2,
          kind: "snapshot" as const,
          label: "SNAPSHOT/review",
          requestId: null,
          command: null,
          envelopeKind: "snapshot" as const,
          snapshot: reviewSnapshot,
          actionPayload: {},
          meta: { machineId: "m-diff-gap" }
        },
        {
          id: "row-review-command",
          timestamp: 3,
          kind: "command" as const,
          label: "COMMAND/goToNextStep",
          requestId: "req-gap",
          command: { type: "goToNextStep" as const },
          envelopeKind: "commandResult" as const,
          snapshot: reviewSnapshot,
          actionPayload: { type: "COMMAND/goToNextStep" },
          meta: { machineId: "m-diff-gap" }
        }
      ],
      selectedTimelineIndex: 2,
      followLatest: false,
      pendingCommandsByRequestId: {}
    };

    expect(selectSelectedDiff(machine)).toEqual(EMPTY_STRUCTURED_DIFF);
  });
});
