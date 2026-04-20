import { describe, expect, it } from "vitest";

import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  type JourneyDevtoolsBridgeEnvelope
} from "@rxova/journey-devtools-bridge";
import {
  INITIAL_SNAPSHOT,
  MAX_MACHINE_TIMELINE_ENTRIES,
  createInitialPanelState,
  panelReducer,
  selectActiveMachine,
  selectDisplayedSnapshot,
  selectSelectedDiff,
  selectSelectedTimelineEntry,
  selectVisibleTimelineEntries,
  type JourneyPanelMachineState,
  type JourneyPanelState
} from "../src/panel/store";
import {
  appendTimelineEntry,
  applyMachineUpdateForEnvelope,
  buildJourneyMachineState,
  buildQueuedTimelineEntry,
  buildTimelineEntry,
  clearPendingCommand,
  normalizeMachineMeta,
  pruneTimelineEntries,
  replaceTimelineEntry,
  resolveSnapshotAtIndex
} from "../src/panel/state/timeline";

const createSnapshot = (
  currentStepId: string,
  context: Record<string, unknown> = {},
  status: "idled" | "running" | "completed" | "terminated" = "running"
) => ({
  currentStepId,
  history: { timeline: [currentStepId], index: 0 },
  context,
  visited: { [currentStepId]: true },
  status,
  async: { isLoading: false, byStep: {} }
});

const createRegisterEnvelope = (
  machineId: string,
  timestamp: number,
  currentStepId: string,
  context: Record<string, unknown> = {}
): Extract<JourneyDevtoolsBridgeEnvelope, { kind: "register" }> => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "register",
  machineId,
  timestamp,
  meta: {
    machineId,
    label: machineId,
    appName: "Test app",
    mode: "graph",
    features: []
  },
  snapshot: createSnapshot(currentStepId, context)
});

const createSnapshotEnvelope = (
  machineId: string,
  timestamp: number,
  currentStepId: string,
  context: Record<string, unknown> = {}
): Extract<JourneyDevtoolsBridgeEnvelope, { kind: "snapshot" }> => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "snapshot",
  machineId,
  timestamp,
  snapshot: createSnapshot(currentStepId, context)
});

const createObservationEnvelope = (
  machineId: string,
  timestamp: number,
  eventType: string
): Extract<JourneyDevtoolsBridgeEnvelope, { kind: "observation" }> => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "observation",
  machineId,
  timestamp,
  event: { type: eventType }
});

const createOperationResultEnvelope = (
  machineId: string,
  requestId: string,
  operationId: string,
  timestamp: number,
  snapshot = createSnapshot("review", { count: 1 }),
  transitioned = true
): Extract<JourneyDevtoolsBridgeEnvelope, { kind: "operationResult" }> => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "operationResult",
  machineId,
  timestamp,
  requestId,
  operationId,
  result: {
    kind: "snapshot",
    snapshot,
    transitioned,
    transitionId: transitioned ? operationId : undefined
  }
});

const createOperationErrorEnvelope = (
  machineId: string,
  requestId: string,
  operationId: string,
  timestamp: number
): Extract<JourneyDevtoolsBridgeEnvelope, { kind: "operationError" }> => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "operationError",
  machineId,
  timestamp,
  requestId,
  operationId,
  error: {
    name: "Error",
    message: "boom",
    stack: null,
    cause: null
  }
});

const createMachine = (
  currentStepId = "start",
  context: Record<string, unknown> = {}
): JourneyPanelMachineState =>
  buildJourneyMachineState("machine-1", createSnapshot(currentStepId, context));

describe("panel state reducer and selectors", () => {
  it("creates the expected empty state", () => {
    expect(createInitialPanelState()).toEqual({
      connected: false,
      machines: {},
      machineOrder: [],
      selectedMachineId: null,
      displayLimit: null
    });
  });

  it("replaces queued commands with operation results and clears pending state", () => {
    let state = createInitialPanelState();
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: createRegisterEnvelope("machine-1", 1000, "start")
    });
    state = panelReducer(state, {
      type: "queue-command",
      machineId: "machine-1",
      requestId: "req-1",
      invocation: { operationId: "core.goToNextStep" },
      timestamp: 1001
    });

    const queuedEntryId = state.machines["machine-1"]?.timelineEntries[1]?.id;

    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: createOperationResultEnvelope(
        "machine-1",
        "req-1",
        "core.goToNextStep",
        1002,
        createSnapshot("review", { count: 2 })
      )
    });

    const machine = state.machines["machine-1"];
    expect(machine?.pendingCommandsByRequestId).toEqual({});
    expect(machine?.snapshot.currentStepId).toBe("review");
    expect(machine?.timelineEntries).toHaveLength(2);
    expect(machine?.timelineEntries[1]?.id).toBe(queuedEntryId);
    expect(machine?.timelineEntries[1]?.meta.transitionId).toBe("core.goToNextStep");
  });

  it("keeps a newer snapshot when an older operation result arrives later", () => {
    let state = createInitialPanelState();
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: createRegisterEnvelope("machine-1", 1000, "start", { count: 0 })
    });
    state = panelReducer(state, {
      type: "queue-command",
      machineId: "machine-1",
      requestId: "req-1",
      invocation: { operationId: "core.goToNextStep" },
      timestamp: 1001
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: createSnapshotEnvelope("machine-1", 1005, "done", { count: 9 })
    });

    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: createOperationResultEnvelope(
        "machine-1",
        "req-1",
        "core.goToNextStep",
        1002,
        createSnapshot("review", { count: 1 })
      )
    });

    expect(state.machines["machine-1"]?.snapshot.currentStepId).toBe("done");
    expect(state.machines["machine-1"]?.snapshot.context).toEqual({ count: 9 });
  });

  it("replaces queued commands with operation errors", () => {
    let state = createInitialPanelState();
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: createRegisterEnvelope("machine-1", 1000, "start")
    });
    state = panelReducer(state, {
      type: "queue-command",
      machineId: "machine-1",
      requestId: "req-1",
      invocation: { operationId: "core.goToNextStep" },
      timestamp: 1001
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: createOperationErrorEnvelope("machine-1", "req-1", "core.goToNextStep", 1002)
    });

    const entry = state.machines["machine-1"]?.timelineEntries[1];
    expect(entry?.kind).toBe("error");
    expect(entry?.meta.errorMessage).toBe("boom");
    expect(state.machines["machine-1"]?.pendingCommandsByRequestId).toEqual({});
  });

  it("updates selection on unregister and falls back to the next machine", () => {
    let state = createInitialPanelState();
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: createRegisterEnvelope("machine-1", 1000, "start")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: createRegisterEnvelope("machine-2", 1001, "review")
    });
    state = panelReducer(state, { type: "select-machine", machineId: "machine-2" });

    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: {
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "unregister",
        machineId: "machine-2",
        timestamp: 1002
      }
    });

    expect(state.selectedMachineId).toBe("machine-1");
    expect(state.machineOrder).toEqual(["machine-1"]);
    expect(state.machines["machine-2"]).toBeUndefined();
  });

  it("clamps selected timeline indices and resolves selected views safely", () => {
    let state: JourneyPanelState = createInitialPanelState();
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: createRegisterEnvelope("machine-1", 1000, "start")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: createSnapshotEnvelope("machine-1", 1001, "review")
    });
    state = panelReducer(state, {
      type: "select-timeline-entry",
      machineId: "machine-1",
      index: 99
    });

    const machine = selectActiveMachine(state);
    expect(machine?.selectedTimelineIndex).toBe(1);
    expect(selectSelectedTimelineEntry(machine)?.label).toBe("SNAPSHOT/review");
    expect(selectDisplayedSnapshot(machine)?.currentStepId).toBe("review");
  });

  it("computes diff against the snapshot before an empty intermediate snapshot for operation results", () => {
    const start = createSnapshot("start", { count: 0 });
    const review = createSnapshot("review", { count: 1 });
    const machine: JourneyPanelMachineState = {
      ...createMachine("review", { count: 1 }),
      followLatest: false,
      selectedTimelineIndex: 2,
      timelineEntries: [
        {
          id: "register",
          timestamp: 1000,
          kind: "init",
          label: "@@INIT",
          requestId: null,
          invocation: null,
          envelopeKind: "register",
          snapshot: start,
          actionPayload: {},
          meta: { machineId: "machine-1" }
        },
        {
          id: "snapshot",
          timestamp: 1001,
          kind: "snapshot",
          label: "SNAPSHOT/review",
          requestId: null,
          invocation: null,
          envelopeKind: "snapshot",
          snapshot: review,
          actionPayload: {},
          meta: { machineId: "machine-1" }
        },
        {
          id: "result",
          timestamp: 1002,
          kind: "operation",
          label: "OP/core.goToNextStep",
          requestId: "req-1",
          invocation: { operationId: "core.goToNextStep" },
          envelopeKind: "operationResult",
          snapshot: review,
          actionPayload: {},
          meta: { machineId: "machine-1", operationId: "core.goToNextStep", transitioned: true }
        }
      ]
    };

    expect(selectSelectedDiff(machine)).toEqual({
      added: {
        "visited.review": true
      },
      removed: {
        "visited.start": true
      },
      changed: {
        currentStepId: { before: "start", after: "review" },
        "history.timeline[0]": { before: "start", after: "review" },
        "context.count": { before: 0, after: 1 }
      }
    });
  });
});

describe("panel timeline helpers", () => {
  it("normalizes missing meta defaults", () => {
    expect(
      normalizeMachineMeta({
        machineId: "machine-1",
        label: "Machine 1",
        appName: null,
        mode: "graph"
      })
    ).toMatchObject({
      machineId: "machine-1",
      mutationsEnabled: true,
      features: []
    });
  });

  it("applies register and snapshot envelopes and can suppress operation-result snapshot replacement", () => {
    const registered = applyMachineUpdateForEnvelope(
      createMachine("unknown"),
      createRegisterEnvelope("machine-1", 1000, "start", { count: 0 })
    );
    expect(registered.snapshot.currentStepId).toBe("start");

    const withSnapshot = applyMachineUpdateForEnvelope(
      registered,
      createSnapshotEnvelope("machine-1", 1001, "review", { count: 1 })
    );
    expect(withSnapshot.snapshot.currentStepId).toBe("review");

    const suppressed = applyMachineUpdateForEnvelope(
      withSnapshot,
      createOperationResultEnvelope(
        "machine-1",
        "req-1",
        "core.goToNextStep",
        1002,
        createSnapshot("done", { count: 2 })
      ),
      { applyOperationResultSnapshot: false }
    );
    expect(suppressed.snapshot.currentStepId).toBe("review");
  });

  it("builds queued, observation, and operation timeline entries with the expected metadata", () => {
    const machine = createMachine();
    const queued = buildQueuedTimelineEntry(
      machine,
      "machine-1",
      "req-1",
      { operationId: "core.goToNextStep" },
      1000
    );
    expect(queued.envelopeKind).toBe("queuedOperation");
    expect(queued.label).toBe("OP/core.goToNextStep");

    const observed = buildTimelineEntry(machine, createObservationEnvelope("machine-1", 1001, "x"));
    expect(observed.kind).toBe("event");
    expect(observed.label).toBe("EVENT/x");

    const pendingMachine = {
      ...machine,
      pendingCommandsByRequestId: {
        "req-1": {
          requestId: "req-1",
          invocation: { operationId: "core.goToNextStep" },
          timestamp: 1000,
          timelineEntryId: queued.id
        }
      }
    };
    const result = buildTimelineEntry(
      pendingMachine,
      createOperationResultEnvelope("machine-1", "req-1", "core.goToNextStep", 1002)
    );
    expect(result.invocation).toEqual({ operationId: "core.goToNextStep" });
    expect(result.meta.transitioned).toBe(true);
  });

  it("appends, replaces, and prunes timeline entries while maintaining selection", () => {
    let machine: JourneyPanelMachineState = {
      ...createMachine(),
      followLatest: false,
      selectedTimelineIndex: 2,
      timelineSequence: MAX_MACHINE_TIMELINE_ENTRIES - 1,
      timelineEntries: Array.from({ length: MAX_MACHINE_TIMELINE_ENTRIES - 1 }, (_, index) => ({
        id: `entry-${index}`,
        timestamp: index,
        kind: "snapshot" as const,
        label: `SNAPSHOT/${index}`,
        requestId: null,
        invocation: null,
        envelopeKind: "snapshot" as const,
        snapshot: createSnapshot(`step-${index}`),
        actionPayload: {},
        meta: { machineId: "machine-1" }
      }))
    };

    machine = appendTimelineEntry(machine, {
      id: "overflow-a",
      timestamp: 3000,
      kind: "snapshot",
      label: "SNAPSHOT/a",
      requestId: null,
      invocation: null,
      envelopeKind: "snapshot",
      snapshot: createSnapshot("a"),
      actionPayload: {},
      meta: { machineId: "machine-1" }
    });
    machine = appendTimelineEntry(machine, {
      id: "overflow-b",
      timestamp: 3001,
      kind: "snapshot",
      label: "SNAPSHOT/b",
      requestId: null,
      invocation: null,
      envelopeKind: "snapshot",
      snapshot: createSnapshot("b"),
      actionPayload: {},
      meta: { machineId: "machine-1" }
    });

    expect(machine.timelineEntries).toHaveLength(MAX_MACHINE_TIMELINE_ENTRIES);
    expect(machine.timelineEntries[0]?.id).toBe("entry-1");
    expect(machine.selectedTimelineIndex).toBe(1);

    const replaced = replaceTimelineEntry(machine, "overflow-a", {
      ...machine.timelineEntries.at(-2)!,
      label: "OP/replaced"
    });
    expect(replaced.timelineEntries.at(-2)?.label).toBe("OP/replaced");

    const appendedOnMiss = replaceTimelineEntry(machine, "missing", {
      id: "appended",
      timestamp: 4000,
      kind: "event",
      label: "EVENT/appended",
      requestId: null,
      invocation: null,
      envelopeKind: "observation",
      snapshot: null,
      actionPayload: {},
      meta: { machineId: "machine-1" }
    });
    expect(appendedOnMiss.timelineEntries.at(-1)?.id).toBe("appended");

    const pruned = pruneTimelineEntries(
      {
        ...appendedOnMiss,
        followLatest: false,
        selectedTimelineIndex: 5
      },
      3
    );
    expect(pruned.timelineEntries).toHaveLength(3);
    expect(pruned.selectedTimelineIndex).toBe(0);
  });

  it("clears pending commands and resolves snapshots by walking backward", () => {
    const pending = {
      "req-1": {
        requestId: "req-1",
        invocation: { operationId: "core.goToNextStep" },
        timestamp: 1000,
        timelineEntryId: "queued"
      }
    };
    expect(clearPendingCommand(pending, "missing")).toBe(pending);
    expect(clearPendingCommand(pending, "req-1")).toEqual({});

    const entries = [
      {
        id: "event",
        timestamp: 1000,
        kind: "event" as const,
        label: "EVENT/x",
        requestId: null,
        invocation: null,
        envelopeKind: "observation" as const,
        snapshot: null,
        actionPayload: {},
        meta: { machineId: "machine-1" }
      },
      {
        id: "snapshot",
        timestamp: 1001,
        kind: "snapshot" as const,
        label: "SNAPSHOT/review",
        requestId: null,
        invocation: null,
        envelopeKind: "snapshot" as const,
        snapshot: createSnapshot("review"),
        actionPayload: {},
        meta: { machineId: "machine-1" }
      },
      {
        id: "error",
        timestamp: 1002,
        kind: "error" as const,
        label: "ERROR/x",
        requestId: null,
        invocation: null,
        envelopeKind: "operationError" as const,
        snapshot: null,
        actionPayload: {},
        meta: { machineId: "machine-1" }
      }
    ];

    expect(resolveSnapshotAtIndex(entries, 2)?.currentStepId).toBe("review");
    expect(resolveSnapshotAtIndex(entries, 0)).toBeNull();
  });
});

describe("panel selectors", () => {
  it("selects active machines and slices visible timeline entries", () => {
    const machine = {
      ...createMachine("review"),
      timelineEntries: [
        {
          id: "0",
          timestamp: 1000,
          kind: "init" as const,
          label: "@@INIT",
          requestId: null,
          invocation: null,
          envelopeKind: "register" as const,
          snapshot: createSnapshot("start"),
          actionPayload: {},
          meta: { machineId: "machine-1" }
        },
        {
          id: "1",
          timestamp: 1001,
          kind: "snapshot" as const,
          label: "SNAPSHOT/review",
          requestId: null,
          invocation: null,
          envelopeKind: "snapshot" as const,
          snapshot: createSnapshot("review"),
          actionPayload: {},
          meta: { machineId: "machine-1" }
        }
      ]
    };
    const state: JourneyPanelState = {
      connected: true,
      machines: { "machine-1": machine },
      machineOrder: ["machine-1"],
      selectedMachineId: "machine-1",
      displayLimit: null
    };

    expect(selectActiveMachine(state)?.snapshot.currentStepId).toBe("review");
    expect(selectVisibleTimelineEntries(machine.timelineEntries, null)).toHaveLength(2);
    expect(
      selectVisibleTimelineEntries(machine.timelineEntries, 1).map((entry) => entry.id)
    ).toEqual(["1"]);
    expect(selectVisibleTimelineEntries(machine.timelineEntries, 0)).toEqual([]);
  });

  it("returns the live snapshot and empty diff defaults when appropriate", () => {
    expect(selectDisplayedSnapshot(null)).toBeNull();
    expect(selectSelectedTimelineEntry(null)).toBeNull();
    expect(selectSelectedDiff(null)).toEqual({ added: {}, removed: {}, changed: {} });
    expect(selectDisplayedSnapshot({ ...createMachine("start"), followLatest: true })).toEqual(
      createSnapshot("start")
    );
    expect(INITIAL_SNAPSHOT.status).toBe("idled");
  });
});
