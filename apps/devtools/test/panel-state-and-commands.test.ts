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
  selectActiveMachine,
  selectDisplayedSnapshot,
  selectSelectedDiff,
  selectSelectedTimelineEntry,
  selectVisibleTimelineEntries,
  type JourneyPanelState
} from "../src/panel/store";
import {
  appendTimelineEntry,
  buildQueuedTimelineEntry,
  buildTimelineEntry,
  normalizeMachineMeta
} from "../src/panel/state/timeline";
import {
  buildInputValue,
  getFieldValidationError,
  groupFeatureSections,
  hasInvalidFieldValues,
  hasMissingRequiredFields,
  isLifecycleOperationDisabled
} from "../src/panel/components/commands/commands";
import { createGraphSnapshot } from "./fixtures";

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
  status: "idle" | "running" | "completed" | "terminated" = "running"
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
    features: coreFeatures
  },
  snapshot: createGraphSnapshot(currentStepId, {
    status,
    availableEvents: currentStepId === "start" ? ["journey.start"] : ["review.submit"],
    availableSteps: currentStepId === "start" ? ["review"] : ["done"]
  })
});

const snapshotEnvelope = (
  machineId: string,
  timestamp: number,
  timeline: string[],
  currentStepId: string,
  status: "idle" | "running" | "completed" | "terminated" = "running"
): Extract<JourneyDevtoolsBridgeEnvelope, { kind: "snapshot" }> => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  kind: "snapshot",
  machineId,
  timestamp,
  snapshot: createGraphSnapshot(currentStepId, { timeline, status })
});

describe("panel state and command helpers", () => {
  it("groups core operations into expected sections", () => {
    const feature = coreFeatures[0];
    if (!feature) {
      throw new Error("missing core feature fixture");
    }
    const sections = groupFeatureSections(feature);

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

  it("groups non-core features and ungrouped core operations", () => {
    expect(
      groupFeatureSections({
        id: "custom",
        label: "Custom",
        description: "Custom operations",
        operations: []
      })
    ).toEqual([
      {
        id: "custom",
        label: "Custom",
        description: "Custom operations",
        operations: []
      }
    ]);

    const sections = groupFeatureSections({
      id: "core",
      label: "Core",
      description: null,
      operations: [
        {
          id: "core.unknown",
          label: "unknown",
          description: null,
          mutates: false,
          output: "data",
          fields: []
        }
      ]
    });

    expect(sections).toEqual([
      {
        id: "core:other",
        label: "Other",
        operations: [
          expect.objectContaining({
            id: "core.unknown"
          })
        ]
      }
    ]);
  });

  it("labels the final core section as Context", () => {
    const feature = coreFeatures[0];
    if (!feature) {
      throw new Error("missing core feature fixture");
    }
    const sections = groupFeatureSections(feature);
    const lastSection = sections[sections.length - 1];
    expect(lastSection?.label).toBe("Context");
    expect(lastSection?.operations.map((operation) => operation.id)).toEqual([
      "core.patchContext",
      "core.updateContext"
    ]);
  });

  it("parses integer, boolean, and json inputs", () => {
    expect(buildInputValue("label", "text")).toEqual({ ok: true, value: "label" });
    expect(buildInputValue("42", "integer")).toEqual({ ok: true, value: 42 });
    expect(buildInputValue("   ", "integer")).toEqual({ ok: true, value: undefined });
    expect(buildInputValue("true", "boolean")).toEqual({ ok: true, value: true });
    expect(buildInputValue("false", "boolean")).toEqual({ ok: true, value: false });
    expect(buildInputValue('{"ok":true}', "json")).toEqual({ ok: true, value: { ok: true } });
    expect(buildInputValue("   ", "json")).toEqual({ ok: true, value: undefined });
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

    const booleanOperation = {
      id: "custom.boolean",
      label: "boolean",
      description: null,
      mutates: false,
      output: "data",
      fields: [{ key: "enabled", label: "enabled", type: "boolean", required: true }]
    } satisfies JourneyDevtoolsMachineFeatureDescriptor["operations"][number];
    expect(hasMissingRequiredFields(booleanOperation, {})).toBe(false);
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
    expect(getFieldValidationError("4.2", "integer")).toBe(
      "Integer fields must contain a whole number."
    );
    expect(getFieldValidationError("anything", "text")).toBeNull();
    expect(getFieldValidationError("true", "boolean")).toBeNull();
  });

  it("disables lifecycle operations by snapshot status", () => {
    expect(isLifecycleOperationDisabled("core.startJourney", "running")).toBe(true);
    expect(isLifecycleOperationDisabled("core.resetJourney", "running")).toBe(false);
    expect(isLifecycleOperationDisabled("core.completeJourney", "idle")).toBe(true);
    expect(isLifecycleOperationDisabled("core.startJourney", "idle")).toBe(false);
    expect(isLifecycleOperationDisabled("core.terminateJourney", "terminated")).toBe(true);
    expect(isLifecycleOperationDisabled("core.resetJourney", "terminated")).toBe(false);
    expect(isLifecycleOperationDisabled("custom.inspect", "loading" as never)).toBe(false);
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
    expect(selectDisplayedSnapshot(machine)?.currentStep?.id).toBe("start");
    expect(selectSelectedTimelineEntry(machine)?.label).toBe("@@INIT");
  });

  it("covers selector null, clamp, and diff fallback branches", () => {
    const emptyState = createInitialPanelState();
    expect(selectActiveMachine(emptyState)).toBeNull();
    expect(selectVisibleTimelineEntries([], null)).toEqual([]);
    expect(selectVisibleTimelineEntries([{ id: "entry" } as never], -5)).toEqual([]);
    expect(selectSelectedTimelineEntry(null)).toBeNull();
    expect(selectDisplayedSnapshot(null)).toBeNull();
    expect(selectSelectedDiff(null)).toEqual({ added: {}, removed: {}, changed: {} });

    let state: JourneyPanelState = panelReducer(emptyState, {
      type: "bridge-envelope",
      envelope: registerEnvelope("machine-a", 1000, "start")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: snapshotEnvelope("machine-a", 1001, ["start", "review"], "review")
    });
    state = {
      ...state,
      machines: {
        ...state.machines,
        "machine-a": {
          ...state.machines["machine-a"]!,
          selectedTimelineIndex: 99,
          followLatest: false
        }
      }
    };

    const machine = state.machines["machine-a"]!;
    expect(selectActiveMachine({ ...state, selectedMachineId: "missing" })).toBeNull();
    expect(selectSelectedTimelineEntry(machine)?.label).toBe("SNAPSHOT/review");
    expect(selectDisplayedSnapshot(machine)?.currentStep?.id).toBe("review");
    expect(selectSelectedDiff(machine).changed["currentStep.id"]).toEqual({
      before: "start",
      after: "review"
    });

    const sparseMachine = {
      ...machine,
      timelineEntries: [undefined as never],
      selectedTimelineIndex: 0,
      followLatest: false
    };
    expect(selectSelectedTimelineEntry(sparseMachine)).toBeNull();
    expect(selectDisplayedSnapshot(sparseMachine)).toBe(machine.snapshot);
    expect(selectSelectedDiff(sparseMachine)).toEqual({ added: {}, removed: {}, changed: {} });
  });

  it("covers timeline defaults for missing optional machine fields", () => {
    const machine = panelReducer(createInitialPanelState(), {
      type: "bridge-envelope",
      envelope: registerEnvelope("machine-a", 1000, "start")
    }).machines["machine-a"]!;
    const legacyMachine = {
      ...machine,
      timelineSequence: undefined as never
    };

    expect(
      normalizeMachineMeta({
        machineId: "legacy",
        label: "Legacy",
        appName: null
      } as never)
    ).toMatchObject({ mutationsEnabled: true, features: [] });

    expect(
      buildQueuedTimelineEntry(
        legacyMachine,
        "machine-a",
        "req-legacy",
        { operationId: "core.goToNextStep" },
        1001
      ).id
    ).toContain("queuedOperation");
    expect(
      buildTimelineEntry(legacyMachine, snapshotEnvelope("machine-a", 1002, ["start"], "start")).id
    ).toContain("snapshot");
    expect(appendTimelineEntry(legacyMachine, machine.timelineEntries[0]!).timelineSequence).toBe(
      2
    );
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
    expect(selectDisplayedSnapshot(machine)?.currentStep?.id).toBe("review");
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

  it("clears selection when unregister removes the final selected machine", () => {
    let state: JourneyPanelState = createInitialPanelState();
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: registerEnvelope("machine-a", 1000, "start")
    });
    state = panelReducer(state, {
      type: "bridge-envelope",
      envelope: {
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "unregister",
        machineId: "machine-a",
        timestamp: 1001
      }
    });

    expect(state.selectedMachineId).toBeNull();
    expect(state.machineOrder).toEqual([]);
  });
});
