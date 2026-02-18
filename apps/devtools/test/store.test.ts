import { describe, expect, it } from "vitest";

import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  type JourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsSerializableSnapshot
} from "@rxova/journey-devtools-bridge";
import {
  createInitialPanelState,
  panelReducer,
  selectActiveMachine,
  selectVisibleLogs
} from "../src/panel/store";

const baseSnapshot = (current: string): JourneyDevtoolsSerializableSnapshot => ({
  current,
  context: { count: current.length },
  history: current === "start" ? [] : ["start"],
  visited: current === "start" ? ["start"] : ["start", current],
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

const registerEnvelope = (machineId: string, label: string): JourneyDevtoolsBridgeEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "register",
  machineId,
  meta: {
    machineId,
    label,
    appName: "Test App"
  },
  snapshot: baseSnapshot("start"),
  timestamp: nextTs()
});

const snapshotEnvelope = (machineId: string, current: string): JourneyDevtoolsBridgeEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "snapshot",
  machineId,
  snapshot: baseSnapshot(current),
  timestamp: nextTs()
});

const commandResultEnvelope = (
  machineId: string,
  requestId: string,
  current: string
): JourneyDevtoolsBridgeEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "commandResult",
  machineId,
  requestId,
  snapshot: baseSnapshot(current),
  transitioned: true,
  transitionId: "next",
  timestamp: nextTs()
});

const commandErrorEnvelope = (
  machineId: string,
  requestId: string
): JourneyDevtoolsBridgeEnvelope => ({
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

const unregisterEnvelope = (machineId: string): JourneyDevtoolsBridgeEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "unregister",
  machineId,
  timestamp: nextTs()
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
    const initial = createInitialPanelState();
    const state = panelReducer(initial, { type: "set-connected", connected: true });
    expect(state.connected).toBe(true);
  });

  it("keeps same state when selecting unknown machine", () => {
    const initial = createInitialPanelState();
    const next = panelReducer(initial, { type: "select-machine", machineId: "missing" });
    expect(next).toBe(initial);
  });

  it("registers first machine and auto-selects it", () => {
    const next = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });

    expect(next.machineOrder).toEqual(["a"]);
    expect(next.selectedMachineId).toBe("a");
    expect(next.machines.a?.meta.label).toBe("Flow A");
    expect(next.machines.a?.logs).toHaveLength(1);
  });

  it("preserves selection when registering additional machines", () => {
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

  it("allows selecting a known machine", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: registerEnvelope("b", "Flow B")
    });

    const next = panelReducer(state, { type: "select-machine", machineId: "b" });
    expect(next.selectedMachineId).toBe("b");
  });

  it("updates snapshot on snapshot envelope", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });

    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: snapshotEnvelope("a", "review")
    });

    expect(state.machines.a?.snapshot.current).toBe("review");
    const latestLog = state.machines.a?.logs[(state.machines.a?.logs.length ?? 1) - 1];
    expect(latestLog?.kind).toBe("snapshot");
  });

  it("updates snapshot on commandResult envelope", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });

    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: commandResultEnvelope("a", "req-1", "details")
    });

    expect(state.machines.a?.snapshot.current).toBe("details");
    const latestLog = state.machines.a?.logs[(state.machines.a?.logs.length ?? 1) - 1];
    expect(latestLog?.kind).toBe("commandResult");
  });

  it("does not alter snapshot on commandError envelope", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });

    const beforeSnapshot = state.machines.a?.snapshot.current;
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: commandErrorEnvelope("a", "req-2")
    });

    expect(state.machines.a?.snapshot.current).toBe(beforeSnapshot);
    const latestLog = state.machines.a?.logs[(state.machines.a?.logs.length ?? 1) - 1];
    expect(latestLog?.kind).toBe("commandError");
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

  it("keeps selection when unregistering a different machine", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: registerEnvelope("b", "Flow B")
    });

    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: unregisterEnvelope("b")
    });

    expect(state.selectedMachineId).toBe("a");
    expect(state.machineOrder).toEqual(["a"]);
  });

  it("updates display limit and prunes logs", () => {
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
    state = panelReducer(state, { type: "prune-logs", machineId: "a", keep: 2 });

    expect(state.displayLimit).toBe(2);
    expect(state.machines.a?.logs).toHaveLength(2);
  });

  it("keeps state for prune requests on missing machine or null keep", () => {
    const state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("a", "Flow A")
    });

    const unchangedForMissing = panelReducer(state, {
      type: "prune-logs",
      machineId: "missing",
      keep: 5
    });
    const unchangedForNull = panelReducer(state, {
      type: "prune-logs",
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
      type: "prune-logs",
      machineId: "a",
      keep: -10
    });

    expect(state.machines.a?.logs).toHaveLength(0);
  });

  it("uses unique log ids even when multiple envelopes share the same timestamp", () => {
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

    const ids = (state.machines.a?.logs ?? []).map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("retains only the latest 2000 logs per machine", () => {
    let state = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("cap", "Flow Cap")
    });

    for (let index = 0; index < 2500; index += 1) {
      state = panelReducer(state, {
        type: "bridge-envelope",
        envelope: snapshotEnvelope("cap", `step-${index}`)
      });
    }

    expect(state.machines.cap?.logs).toHaveLength(2000);
    expect(state.machines.cap?.logs[0]?.summary).toContain("step-500");
    expect(state.machines.cap?.logs[1999]?.summary).toContain("step-2499");
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

  it("selectVisibleLogs returns full copy for null limit", () => {
    const logs = [
      { id: "1", timestamp: 1, kind: "snapshot" as const, summary: "one" },
      { id: "2", timestamp: 2, kind: "snapshot" as const, summary: "two" }
    ];

    const visible = selectVisibleLogs(logs, null);
    expect(visible).toEqual(logs);
    expect(visible).not.toBe(logs);
  });

  it("selectVisibleLogs respects positive and negative limits", () => {
    const logs = [
      { id: "1", timestamp: 1, kind: "snapshot" as const, summary: "one" },
      { id: "2", timestamp: 2, kind: "snapshot" as const, summary: "two" },
      { id: "3", timestamp: 3, kind: "snapshot" as const, summary: "three" }
    ];

    expect(selectVisibleLogs(logs, 2).map((entry) => entry.id)).toEqual(["2", "3"]);
    expect(selectVisibleLogs(logs, -2)).toEqual([]);
  });
});
