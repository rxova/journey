import { describe, expect, it } from "vitest";

import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  type JourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsMachineFeatureDescriptor
} from "@rxova/journey-devtools-bridge";
import {
  createInitialPanelState,
  panelReducer,
  selectDisplayedSnapshot,
  selectSelectedTimelineEntry,
  type JourneyPanelState
} from "../src/panel/store";
import {
  buildInputValue,
  getFieldValidationError,
  groupFeatureSections,
  hasInvalidFieldValues,
  hasMissingRequiredFields,
  isLifecycleOperationDisabled
} from "../src/panel/components/commands/commands";

const coreFeatures: JourneyDevtoolsMachineFeatureDescriptor[] = [
  {
    id: "core",
    label: "Core",
    description: null,
    operations: [
      {
        id: "core.startJourney",
        label: "startJourney",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: []
      },
      {
        id: "core.resetJourney",
        label: "resetJourney",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: []
      },
      {
        id: "core.goToNextStep",
        label: "goToNextStep",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: []
      },
      {
        id: "core.goToStepById",
        label: "goToStepById",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: [{ key: "stepId", label: "stepId", type: "text", required: true }]
      },
      {
        id: "core.forceStepTransition",
        label: "forceStepTransition",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: [{ key: "stepId", label: "to", type: "text", required: true }]
      },
      {
        id: "core.sendEvent",
        label: "send",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: [
          { key: "type", label: "type", type: "text", required: true },
          { key: "payload", label: "payload", type: "json" }
        ]
      },
      {
        id: "core.updateContext",
        label: "replaceContext",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: [{ key: "context", label: "context", type: "json", required: true }]
      },
      {
        id: "core.patchContext",
        label: "patchContext",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: [
          { key: "key", label: "key", type: "text", required: true },
          { key: "value", label: "value", type: "json", required: true }
        ]
      },
      {
        id: "core.clearStepError",
        label: "clearStepError",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: [{ key: "stepId", label: "stepId", type: "text" }]
      },
      {
        id: "core.completeJourney",
        label: "completeJourney",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: []
      },
      {
        id: "core.terminateJourney",
        label: "terminateJourney",
        description: null,
        mutates: true,
        output: "snapshot",
        fields: []
      }
    ]
  }
];

const registerEnvelope = (
  machineId: string,
  timestamp: number,
  currentStepId: string,
  status: "idled" | "running" | "completed" | "terminated" = "running"
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
    appName: "Store",
    mutationsEnabled: true,
    mode: "graph",
    stepIds: ["start", "review", "done"],
    eventTypes: ["journey.start", "review.submit"],
    eventTypesBySource: {
      start: ["journey.start"],
      review: ["review.submit"]
    },
    goToStepTargetsBySource: {
      start: ["review"],
      review: ["done"]
    },
    features: coreFeatures
  },
  snapshot: {
    currentStepId,
    history: { timeline: [currentStepId], index: 0 },
    context: {},
    visited: { [currentStepId]: true },
    status,
    async: { isLoading: false, byStep: {} }
  }
});

const snapshotEnvelope = (
  machineId: string,
  timestamp: number,
  timeline: string[],
  currentStepId: string,
  status: "idled" | "running" | "completed" | "terminated" = "running"
): Extract<JourneyDevtoolsBridgeEnvelope, { kind: "snapshot" }> => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "snapshot",
  machineId,
  timestamp,
  snapshot: {
    currentStepId,
    history: { timeline, index: timeline.length - 1 },
    context: {},
    visited: Object.fromEntries(timeline.map((stepId) => [stepId, true])),
    status,
    async: { isLoading: false, byStep: {} }
  }
});

describe("panel state and command helpers", () => {
  it("groups core operations into expected sections", () => {
    const sections = groupFeatureSections(coreFeatures[0]);

    expect(sections.map((section) => section.id)).toEqual([
      "core:machine-commands",
      "core:navigation",
      "core:events",
      "core:commands"
    ]);
    expect(sections[1]?.operations.map((operation) => operation.id)).toEqual([
      "core.goToNextStep",
      "core.goToStepById",
      "core.forceStepTransition"
    ]);
  });

  it("labels the final core section as Context", () => {
    const sections = groupFeatureSections(coreFeatures[0]);
    expect(sections.at(-1)?.label).toBe("Context");
    expect(sections.at(-1)?.operations.map((operation) => operation.id)).toEqual([
      "core.patchContext",
      "core.updateContext"
    ]);
  });

  it("parses integer, boolean, and json inputs", () => {
    expect(buildInputValue("42", "integer")).toEqual({ ok: true, value: 42 });
    expect(buildInputValue("true", "boolean")).toEqual({ ok: true, value: true });
    expect(buildInputValue('{"ok":true}', "json")).toEqual({ ok: true, value: { ok: true } });
  });

  it("rejects invalid integer and json inputs", () => {
    expect(buildInputValue("4.2", "integer")).toEqual({
      ok: false,
      error: "Integer fields must contain a whole number."
    });
    expect(buildInputValue("{oops", "json")).toEqual({
      ok: false,
      error: "JSON fields must contain valid JSON."
    });
  });

  it("detects missing required fields", () => {
    const operation = coreFeatures[0]!.operations.find((entry) => entry.id === "core.goToStepById");
    expect(operation).toBeTruthy();
    expect(hasMissingRequiredFields(operation!, {})).toBe(true);
    expect(hasMissingRequiredFields(operation!, { "core.goToStepById:stepId": "review" })).toBe(
      false
    );
  });

  it("detects invalid json field values", () => {
    const operation = coreFeatures[0]!.operations.find((entry) => entry.id === "core.patchContext");
    expect(operation).toBeTruthy();
    expect(
      hasInvalidFieldValues(operation!, {
        "core.patchContext:key": "attempts",
        "core.patchContext:value": "{oops"
      })
    ).toBe(true);
    expect(
      hasInvalidFieldValues(operation!, {
        "core.patchContext:key": "attempts",
        "core.patchContext:value": "2"
      })
    ).toBe(false);
    expect(getFieldValidationError("{oops", "json")).toBe("JSON fields must contain valid JSON.");
  });

  it("disables lifecycle operations by snapshot status", () => {
    expect(isLifecycleOperationDisabled("core.startJourney", "running")).toBe(true);
    expect(isLifecycleOperationDisabled("core.completeJourney", "idled")).toBe(true);
    expect(isLifecycleOperationDisabled("core.terminateJourney", "terminated")).toBe(true);
    expect(isLifecycleOperationDisabled("core.resetJourney", "terminated")).toBe(false);
  });

  it("selects the first machine on initial register", () => {
    let state = createInitialPanelState();
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: registerEnvelope("machine-a", 1000, "start")
    });

    expect(state.selectedMachineId).toBe("machine-a");
    expect(state.machineOrder).toEqual(["machine-a"]);
  });

  it("switches machine selection and forces followLatest to latest entry", () => {
    let state: JourneyPanelState = createInitialPanelState();
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: registerEnvelope("machine-a", 1000, "start")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: snapshotEnvelope("machine-a", 1001, ["start", "review"], "review")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: registerEnvelope("machine-b", 1002, "start")
    });
    state = panelReducer(state, {
      type: "select-machine",
      machineId: "machine-a"
    });

    expect(state.selectedMachineId).toBe("machine-a");
    expect(state.machines["machine-a"]?.followLatest).toBe(true);
    expect(state.machines["machine-a"]?.selectedTimelineIndex).toBe(1);
  });

  it("uses selected timeline snapshot when followLatest is disabled", () => {
    let state: JourneyPanelState = createInitialPanelState();
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: registerEnvelope("machine-a", 1000, "start")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: snapshotEnvelope("machine-a", 1001, ["start", "review"], "review")
    });
    state = panelReducer(state, {
      type: "select-timeline-entry",
      machineId: "machine-a",
      index: 0
    });

    const machine = state.machines["machine-a"]!;
    expect(machine.followLatest).toBe(false);
    expect(selectDisplayedSnapshot(machine)?.currentStepId).toBe("start");
    expect(selectSelectedTimelineEntry(machine)?.label).toBe("@@INIT");
  });

  it("restores latest snapshot when followLatest is re-enabled", () => {
    let state: JourneyPanelState = createInitialPanelState();
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: registerEnvelope("machine-a", 1000, "start")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: snapshotEnvelope("machine-a", 1001, ["start", "review"], "review")
    });
    state = panelReducer(state, {
      type: "select-timeline-entry",
      machineId: "machine-a",
      index: 0
    });
    state = panelReducer(state, {
      type: "set-follow-latest",
      machineId: "machine-a",
      followLatest: true
    });

    const machine = state.machines["machine-a"]!;
    expect(machine.followLatest).toBe(true);
    expect(selectDisplayedSnapshot(machine)?.currentStepId).toBe("review");
  });

  it("clears machines and selection on disconnect reset", () => {
    let state: JourneyPanelState = createInitialPanelState();
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: registerEnvelope("machine-a", 1000, "start")
    });
    state = panelReducer(state, { type: "clear-machines" });

    expect(state.machines).toEqual({});
    expect(state.machineOrder).toEqual([]);
    expect(state.selectedMachineId).toBeNull();
  });
});
