import { describe, expect, it } from "vitest";

import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  type JourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsSerializableSnapshot
} from "@rxova/journey-devtools-bridge";
import type { JourneyJsonObject } from "@rxova/journey-core";
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
  type JourneyPanelTimelineEntry,
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
  context: JourneyJsonObject = {},
  status: "idled" | "running" | "completed" | "terminated" = "running"
): JourneyDevtoolsSerializableSnapshot => ({
  type: "graph",
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
  context: JourneyJsonObject = {}
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
  context: JourneyJsonObject = {}
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
  result: transitioned
    ? {
        kind: "snapshot",
        snapshot,
        transitioned: true,
        transitionId: operationId
      }
    : {
        kind: "snapshot",
        snapshot,
        transitioned: false
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
  context: JourneyJsonObject = {}
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

  it("leaves state unchanged for missing-machine reducer actions", () => {
    const state = createInitialPanelState();

    expect(panelReducer(state, { type: "select-machine", machineId: "missing" })).toBe(state);
    expect(
      panelReducer(state, {
        type: "set-follow-latest",
        machineId: "missing",
        followLatest: false
      })
    ).toBe(state);
    expect(
      panelReducer(state, {
        type: "select-timeline-entry",
        machineId: "missing",
        index: 1
      })
    ).toBe(state);
    expect(
      panelReducer(state, {
        type: "prune-timeline",
        machineId: "missing",
        keep: 1
      })
    ).toBe(state);
    expect(
      panelReducer(state, {
        type: "queue-command",
        machineId: "missing",
        requestId: "req-1",
        invocation: { operationId: "core.goToNextStep" },
        timestamp: 1
      })
    ).toBe(state);
  });

  it("handles reducer branches for display limit, follow latest, and pruning no-ops", () => {
    let state = createInitialPanelState();
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: createRegisterEnvelope("machine-1", 1000, "start")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: createSnapshotEnvelope("machine-1", 1001, "review")
    });

    state = panelReducer(state, { type: "set-display-limit", limit: 25 });
    expect(state.displayLimit).toBe(25);

    state = panelReducer(state, {
      type: "select-timeline-entry",
      machineId: "machine-1",
      index: -10
    });
    expect(state.machines["machine-1"]?.selectedTimelineIndex).toBe(0);
    expect(state.machines["machine-1"]?.followLatest).toBe(false);

    state = panelReducer(state, {
      type: "set-follow-latest",
      machineId: "machine-1",
      followLatest: true
    });
    expect(state.machines["machine-1"]?.selectedTimelineIndex).toBe(1);

    const beforeNullPrune = state;
    expect(
      panelReducer(state, {
        type: "prune-timeline",
        machineId: "machine-1",
        keep: null
      })
    ).toBe(beforeNullPrune);
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
        mode: "graph",
        features: []
      })
    ).toMatchObject({
      machineId: "machine-1",
      mutationsEnabled: true,
      features: []
    });

    expect(
      normalizeMachineMeta({
        machineId: "machine-2",
        label: "Machine 2",
        appName: null,
        features: undefined,
        mutationsEnabled: false
      } as never)
    ).toMatchObject({
      machineId: "machine-2",
      mutationsEnabled: false,
      features: []
    });
  });

  it("covers timeline helper default sequence and optional result metadata branches", () => {
    const machine = {
      ...createMachine(),
      timelineSequence: undefined
    } as unknown as JourneyPanelMachineState;

    const queued = buildQueuedTimelineEntry(
      machine,
      "machine-1",
      "req-queued",
      { operationId: "core.goToNextStep" },
      1000
    );
    expect(queued.id).toBe("machine-1-timeline-queuedOperation-1000-1");

    const snapshotResult = buildTimelineEntry(machine, {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      kind: "operationResult",
      machineId: "machine-1",
      timestamp: 1001,
      requestId: "req-result",
      operationId: "core.goToNextStep",
      result: {
        kind: "snapshot",
        snapshot: createSnapshot("review")
      }
    });
    expect(snapshotResult.meta).toMatchObject({
      machineId: "machine-1",
      operationId: "core.goToNextStep"
    });
    expect(snapshotResult.meta).not.toHaveProperty("transitioned");
    expect(snapshotResult.meta).not.toHaveProperty("transitionId");

    const appended = appendTimelineEntry(machine, {
      ...snapshotResult,
      id: "appended"
    });
    expect(appended.selectedTimelineIndex).toBe(0);
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

    const dataResult = applyMachineUpdateForEnvelope(suppressed, {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      kind: "operationResult",
      machineId: "machine-1",
      timestamp: 1003,
      requestId: "req-data",
      operationId: "custom.inspect",
      result: { kind: "data", data: { ok: true } }
    });
    expect(dataResult.snapshot.currentStepId).toBe("review");

    const observed = applyMachineUpdateForEnvelope(
      dataResult,
      createObservationEnvelope("machine-1", 1004, "journey.start")
    );
    expect(observed).toBe(dataResult);
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

    const observedWithoutType = buildTimelineEntry(machine, {
      ...createObservationEnvelope("machine-1", 1001, "x"),
      event: {} as never
    });
    expect(observedWithoutType.label).toBe("EVENT/event");

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

    const dataResult = buildTimelineEntry(pendingMachine, {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      kind: "operationResult",
      machineId: "machine-1",
      timestamp: 1003,
      requestId: "req-missing",
      operationId: "custom.inspect",
      result: { kind: "data", data: { ok: true } }
    });
    expect(dataResult.snapshot).toBeNull();
    expect(dataResult.invocation).toBeNull();

    const errorWithoutPending = buildTimelineEntry(
      machine,
      createOperationErrorEnvelope("machine-1", "missing", "core.goToNextStep", 1004)
    );
    expect(errorWithoutPending.invocation).toBeNull();
  });

  it("appends, replaces, and prunes timeline entries while maintaining selection", () => {
    let machine: JourneyPanelMachineState = {
      ...createMachine(),
      followLatest: false,
      selectedTimelineIndex: 2,
      timelineSequence: MAX_MACHINE_TIMELINE_ENTRIES - 1,
      timelineEntries: Array.from(
        { length: MAX_MACHINE_TIMELINE_ENTRIES - 1 },
        (_, index): JourneyPanelTimelineEntry => ({
          id: `entry-${index}`,
          timestamp: index,
          kind: "snapshot",
          label: `SNAPSHOT/${index}`,
          requestId: null,
          invocation: null,
          envelopeKind: "snapshot",
          snapshot: createSnapshot(`step-${index}`),
          actionPayload: {},
          meta: { machineId: "machine-1" }
        })
      )
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

    const secondToLastEntry = machine.timelineEntries[machine.timelineEntries.length - 2];
    if (!secondToLastEntry) {
      throw new Error("expected second-to-last timeline entry");
    }
    const replaced = replaceTimelineEntry(machine, "overflow-a", {
      ...secondToLastEntry,
      label: "OP/replaced"
    });
    expect(replaced.timelineEntries[replaced.timelineEntries.length - 2]?.label).toBe(
      "OP/replaced"
    );

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
    expect(appendedOnMiss.timelineEntries[appendedOnMiss.timelineEntries.length - 1]?.id).toBe(
      "appended"
    );

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

    expect(pruneTimelineEntries(pruned, 99)).toBe(pruned);

    const followLatestPruned = pruneTimelineEntries(
      {
        ...appendedOnMiss,
        followLatest: true,
        selectedTimelineIndex: 0
      },
      2
    );
    expect(followLatestPruned.selectedTimelineIndex).toBe(1);

    const emptyPruned = pruneTimelineEntries(appendedOnMiss, -1);
    expect(emptyPruned.timelineEntries).toHaveLength(0);
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

    const entries: JourneyPanelTimelineEntry[] = [
      {
        id: "event",
        timestamp: 1000,
        kind: "event",
        label: "EVENT/x",
        requestId: null,
        invocation: null,
        envelopeKind: "observation",
        snapshot: null,
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
        snapshot: createSnapshot("review"),
        actionPayload: {},
        meta: { machineId: "machine-1" }
      },
      {
        id: "error",
        timestamp: 1002,
        kind: "error",
        label: "ERROR/x",
        requestId: null,
        invocation: null,
        envelopeKind: "operationError",
        snapshot: null,
        actionPayload: {},
        meta: { machineId: "machine-1" }
      }
    ];

    expect(resolveSnapshotAtIndex(entries, 2)?.currentStepId).toBe("review");
    expect(resolveSnapshotAtIndex(entries, 0)).toBeNull();
    expect(resolveSnapshotAtIndex(entries, -1)).toBeNull();
    expect(resolveSnapshotAtIndex(entries, 99)?.currentStepId).toBe("review");
  });
});

describe("panel selectors", () => {
  it("selects active machines and slices visible timeline entries", () => {
    const machine: JourneyPanelMachineState = {
      ...createMachine("review"),
      timelineEntries: [
        {
          id: "0",
          timestamp: 1000,
          kind: "init",
          label: "@@INIT",
          requestId: null,
          invocation: null,
          envelopeKind: "register",
          snapshot: createSnapshot("start"),
          actionPayload: {},
          meta: { machineId: "machine-1" }
        },
        {
          id: "1",
          timestamp: 1001,
          kind: "snapshot",
          label: "SNAPSHOT/review",
          requestId: null,
          invocation: null,
          envelopeKind: "snapshot",
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
    expect(INITIAL_SNAPSHOT.status).toBe("idle");
  });
});
