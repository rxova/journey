import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION } from "@rxova/journey-devtools-bridge";
import type { JourneyDevtoolsSerializableSnapshot } from "@rxova/journey-devtools-bridge";
import type { JourneyPanelStructuredDiff } from "../src/panel/diff";
import type {
  JourneyPanelMachineState,
  JourneyPanelState,
  JourneyPanelTimelineEntry
} from "../src/panel/store";
import { ActiveMachinePanel } from "../src/panel/components/ActiveMachinePanel";
import { AppShell } from "../src/panel/components/AppShell";
import { CompatibilityNotice } from "../src/panel/components/CompatibilityNotice";
import { ConnectionStatus } from "../src/panel/components/ConnectionStatus";
import { CommandControls } from "../src/panel/components/CommandControls";
import { EmptyMachineState } from "../src/panel/components/EmptyMachineState";
import { JourneyMachineSelector } from "../src/panel/components/JourneyMachineSelector";
import { JsonBlock } from "../src/panel/components/JsonBlock";
import { OperationField } from "../src/panel/components/commands/OperationField";
import { OperationSectionCard } from "../src/panel/components/commands/OperationSectionCard";
import { PanelHeader } from "../src/panel/components/PanelHeader";
import { SectionErrorBoundary } from "../src/panel/components/SectionErrorBoundary";
import { TimelineInspector } from "../src/panel/components/TimelineInspector";
import {
  TimelineList,
  observeTimelineElementOffset,
  observeTimelineElementRect
} from "../src/panel/components/timeline/TimelineList";
import {
  parseDisplayLimit,
  updateDisplayLimit
} from "../src/panel/components/timeline/TimelineToolbar";
import { getProtocolMismatchReason, isLegacyProtocolVersion } from "../src/panel/utils/protocol";
import { createGraphSnapshot } from "./fixtures";

const panelProviderMocks = vi.hoisted(() => ({
  usePanelState: vi.fn(),
  usePanelActions: vi.fn(),
  usePanelConnection: vi.fn(),
  useActiveMachine: vi.fn(),
  useLegacyProtocolState: vi.fn(),
  usePanelTimelineRetention: vi.fn()
}));

vi.mock("../src/panel/context/PanelProvider", () => panelProviderMocks);

type MountedView = {
  container: HTMLDivElement;
  rerender: (node: React.ReactElement) => Promise<void>;
  unmount: () => Promise<void>;
};

const mount = async (node: React.ReactElement): Promise<MountedView> => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  await act(async () => {
    root.render(node);
  });

  return {
    container,
    rerender: async (nextNode: React.ReactElement) => {
      await act(async () => {
        root.render(nextNode);
      });
    },
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  };
};

const click = async (element: Element) => {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

const setInputValue = async (
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
) => {
  await act(async () => {
    let prototype: object = HTMLInputElement.prototype;
    if (element instanceof HTMLTextAreaElement) {
      prototype = HTMLTextAreaElement.prototype;
    } else if (element instanceof HTMLSelectElement) {
      prototype = HTMLSelectElement.prototype;
    }
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    setter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
};

const snapshot: JourneyDevtoolsSerializableSnapshot = createGraphSnapshot("start", {
  timeline: ["start", "review"],
  context: { attempts: 1 },
  availableEvents: ["submitLogin"],
  availableSteps: ["review"]
});

const diff: JourneyPanelStructuredDiff = {
  added: { "context.newFlag": true },
  removed: {},
  changed: {
    "context.attempts": {
      before: 1,
      after: 2
    }
  }
};

const createTimelineEntry = (
  overrides: Partial<JourneyPanelTimelineEntry> = {}
): JourneyPanelTimelineEntry => ({
  id: "entry-1",
  timestamp: 1,
  kind: "snapshot",
  label: "SNAPSHOT/review",
  requestId: null,
  invocation: null,
  envelopeKind: "snapshot",
  snapshot: createGraphSnapshot("review", {
    timeline: ["start", "review"],
    context: { attempts: 1 }
  }),
  actionPayload: { type: "SNAPSHOT/review" },
  meta: { machineId: "m1" },
  ...overrides
});

const createMachineState = (
  overrides: Partial<JourneyPanelMachineState> = {}
): JourneyPanelMachineState => ({
  meta: {
    machineId: "m1",
    label: "Checkout",
    appName: "Store",
    mutationsEnabled: true,
    mode: "graph",
    stepIds: ["start", "review"],
    eventTypes: ["submitLogin"],
    features: [
      {
        id: "core",
        label: "Core",
        description: null,
        operations: [
          {
            id: "core.goToNextStep",
            label: "goToNextStep",
            description: null,
            mutates: true,
            output: "snapshot",
            fields: []
          }
        ]
      }
    ]
  },
  protocolVersion: 5,
  snapshot,
  timelineEntries: [createTimelineEntry()],
  selectedTimelineIndex: 0,
  followLatest: true,
  pendingCommandsByRequestId: {},
  ...overrides
});

beforeEach(() => {
  panelProviderMocks.usePanelState.mockReset();
  panelProviderMocks.usePanelActions.mockReset();
  panelProviderMocks.usePanelConnection.mockReset();
  panelProviderMocks.useActiveMachine.mockReset();
  panelProviderMocks.useLegacyProtocolState.mockReset();
  panelProviderMocks.usePanelTimelineRetention.mockReset();

  panelProviderMocks.usePanelState.mockReturnValue({
    panelState: {
      connected: true,
      machines: {},
      machineOrder: [],
      selectedMachineId: null,
      displayLimit: 50
    } satisfies JourneyPanelState,
    connectionWarning: null,
    displayConnected: true,
    activeMachine: null,
    displayedSnapshot: null,
    selectedTimelineEntry: null,
    selectedDiff: diff,
    isCommandChannelReady: true,
    protocolMismatchReason: null,
    areCommandsDisabled: false,
    commandDisabledReason: null
  });
  panelProviderMocks.usePanelActions.mockReturnValue({
    selectMachine: vi.fn(),
    selectTimelineEntry: vi.fn(),
    setFollowLatest: vi.fn(),
    setDisplayLimit: vi.fn(),
    pruneTimeline: vi.fn(),
    invokeOperation: vi.fn()
  });
  panelProviderMocks.usePanelConnection.mockReturnValue({
    connectionWarning: null,
    displayConnected: true,
    isCommandChannelReady: true
  });
  panelProviderMocks.useActiveMachine.mockReturnValue({
    activeMachine: null,
    displayedSnapshot: null,
    selectedTimelineEntry: null,
    selectedDiff: diff,
    protocolMismatchReason: null,
    areCommandsDisabled: false,
    commandDisabledReason: null
  });
  panelProviderMocks.useLegacyProtocolState.mockReturnValue({
    protocolMismatchReason: null,
    isLegacyProtocol: false
  });
  panelProviderMocks.usePanelTimelineRetention.mockReturnValue(2000);

  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.stubGlobal("navigator", {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined)
    }
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("panel components", () => {
  it("renders the header and empty state", async () => {
    const header = await mount(<PanelHeader />);
    expect(header.container.textContent).toContain("Rxova Journey Devtools");
    await header.unmount();

    const empty = await mount(<EmptyMachineState />);
    expect(empty.container.textContent).toContain("No Active Machine");
    expect(empty.container.textContent).toContain("attachJourneyDevtools(machine)");
    await empty.unmount();
  });

  it("renders connection status guidance variants", async () => {
    const view = await mount(<ConnectionStatus connected={false} warning={null} />);
    expect(view.container.textContent).toContain("Waiting for bridge messages");

    await view.rerender(
      <ConnectionStatus
        connected
        warning={{
          code: "injection-failed",
          message: "Injection failed",
          recoverable: true,
          tabId: 1
        }}
      />
    );
    expect(view.container.textContent).toContain("Reload the inspected tab");

    await view.rerender(
      <ConnectionStatus
        connected
        warning={{
          code: "injection-missing-entry",
          message: "Missing bridge entry",
          recoverable: false,
          tabId: 1
        }}
      />
    );
    expect(view.container.textContent).toContain("content bridge entry");

    await view.rerender(
      <ConnectionStatus
        connected
        warning={{
          code: "injection-failed",
          message: "Permanent failure",
          recoverable: false,
          tabId: 1
        }}
      />
    );
    expect(view.container.textContent).toContain("may not be recoverable");

    await view.rerender(
      <ConnectionStatus
        connected
        warning={{
          code: "injection-unavailable",
          message: "Unavailable",
          recoverable: false,
          tabId: 1
        }}
      />
    );
    expect(view.container.textContent).toContain("dynamic script injection");

    await view.rerender(
      <ConnectionStatus
        connected
        warning={{
          code: "other" as never,
          message: "Unknown warning",
          recoverable: true,
          tabId: 1
        }}
      />
    );
    expect(view.container.textContent).toContain("Unknown warning");
    expect(view.container.textContent).not.toContain("dynamic script injection");
    await view.unmount();
  });

  it("renders machine selector, json block, and error boundary fallback", async () => {
    const onSelect = vi.fn();
    const selector = await mount(
      <JourneyMachineSelector
        machineOrder={["m1"]}
        machines={{ m1: createMachineState() }}
        selectedMachineId="m1"
        onSelect={onSelect}
      />
    );
    const select = selector.container.querySelector("select");
    expect(select).toBeTruthy();
    if (!select) {
      throw new Error("missing select");
    }
    await setInputValue(select as HTMLSelectElement, "m1");
    expect(onSelect).toHaveBeenCalledWith("m1");

    await selector.rerender(
      <JourneyMachineSelector
        machineOrder={["m1"]}
        machines={{
          m1: createMachineState({ meta: { ...createMachineState().meta, appName: null } })
        }}
        selectedMachineId={null}
        onSelect={onSelect}
      />
    );
    expect(selector.container.textContent).toContain("Checkout");
    expect(selector.container.textContent).not.toContain("(Store)");
    await selector.unmount();

    const emptySelector = await mount(
      <JourneyMachineSelector
        machineOrder={["missing"]}
        machines={{}}
        selectedMachineId={null}
        onSelect={onSelect}
      />
    );
    expect(emptySelector.container.textContent).toContain("Journey Machines");
    expect(emptySelector.container.textContent).not.toContain("No journey machines");
    await emptySelector.unmount();

    const json = await mount(<JsonBlock value={{ total: BigInt(42) }} />);
    expect(json.container.textContent).toContain('"42"');
    await json.unmount();

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let shouldThrow = true;
    const FailingSection = () => {
      if (shouldThrow) {
        throw new Error("section exploded");
      }
      return <p>Recovered</p>;
    };
    const boundary = await mount(
      <SectionErrorBoundary section="Timeline">
        <FailingSection />
      </SectionErrorBoundary>
    );
    expect(boundary.container.textContent).toContain("Timeline Error");
    shouldThrow = false;
    const retryButton = boundary.container.querySelector("button");
    if (!retryButton) {
      throw new Error("missing retry button");
    }
    await click(retryButton);
    expect(boundary.container.textContent).toContain("Recovered");
    consoleError.mockRestore();
    await boundary.unmount();
  });

  it("handles timeline inspector controls, tabs, and copy state", async () => {
    const onSelectEntry = vi.fn();
    const onFollowLatestChange = vi.fn();
    const onDisplayLimitChange = vi.fn();
    const onPrune = vi.fn();
    const operationEntry = createTimelineEntry({
      id: "entry-2",
      kind: "operation",
      label: "core.goToStepById",
      requestId: "req-1",
      invocation: { operationId: "core.goToStepById" },
      envelopeKind: "operationResult",
      actionPayload: { invocation: "payload" },
      meta: {
        machineId: "m1",
        operationId: "core.goToStepById",
        transitioned: false
      }
    });

    const view = await mount(
      <TimelineInspector
        entries={[createTimelineEntry(), operationEntry]}
        selectedIndex={1}
        selectedEntry={operationEntry}
        displayedSnapshot={snapshot}
        selectedDiff={diff}
        followLatest={true}
        displayLimit={25}
        retentionCap={2000}
        onSelectEntry={onSelectEntry}
        onFollowLatestChange={onFollowLatestChange}
        onDisplayLimitChange={onDisplayLimitChange}
        onPrune={onPrune}
      />
    );

    expect(view.container.textContent).toContain("Showing 2 / 2");
    expect(view.container.textContent).toContain("NOOP");

    const listButtons = Array.from(view.container.querySelectorAll('[role="listitem"] button'));
    await click(listButtons[0] as HTMLButtonElement);
    expect(onSelectEntry).toHaveBeenCalledWith(0);

    const followButton = Array.from(view.container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Following latest")
    );
    if (!followButton) {
      throw new Error("missing follow button");
    }
    await click(followButton);
    expect(onFollowLatestChange).toHaveBeenCalledWith(false);

    const displayLimitInput = view.container.querySelector('input[type="number"]');
    if (!displayLimitInput) {
      throw new Error("missing display limit input");
    }
    await setInputValue(displayLimitInput as HTMLInputElement, "");
    expect(onDisplayLimitChange).toHaveBeenCalledWith(null);
    await setInputValue(displayLimitInput as HTMLInputElement, "10");
    expect(onDisplayLimitChange).toHaveBeenCalledWith(10);
    await setInputValue(displayLimitInput as HTMLInputElement, "1e999");
    expect(onDisplayLimitChange).not.toHaveBeenCalledWith(Infinity);
    expect(parseDisplayLimit("1e999")).toBeUndefined();
    expect(parseDisplayLimit(" -4 ")).toBe(1);
    updateDisplayLimit("1e999", onDisplayLimitChange);
    expect(onDisplayLimitChange).not.toHaveBeenCalledWith(Infinity);

    const pruneButton = Array.from(view.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Prune to limit"
    );
    if (!pruneButton) {
      throw new Error("missing prune button");
    }
    await click(pruneButton);
    expect(onPrune).toHaveBeenCalled();

    const snapshotTab = Array.from(view.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Snapshot"
    );
    if (!snapshotTab) {
      throw new Error("missing snapshot tab");
    }
    await click(snapshotTab);
    expect(view.container.textContent).toContain('"id": "start"');

    const diffTab = Array.from(view.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Diff"
    );
    if (!diffTab) {
      throw new Error("missing diff tab");
    }
    await click(diffTab);
    expect(view.container.textContent).toContain("context.newFlag");

    const copyButton = Array.from(view.container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Copy")
    );
    if (!copyButton) {
      throw new Error("missing copy button");
    }
    await click(copyButton);
    expect(vi.mocked(navigator.clipboard.writeText)).toHaveBeenCalled();

    const toggleButton = Array.from(view.container.querySelectorAll("button")).find(
      (button) => button.getAttribute("aria-label") === "Collapse Timeline"
    );
    if (!toggleButton) {
      throw new Error("missing toggle button");
    }
    await click(toggleButton);
    expect(view.container.textContent).not.toContain("Prune to limit");
    await view.unmount();
  });

  it("renders timeline empty, fallback, and copy-error branches", async () => {
    vi.stubGlobal("navigator", { clipboard: undefined });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn().mockReturnValue(true)
    });
    const execCommand = vi.spyOn(document, "execCommand").mockReturnValue(true);
    const empty = await mount(
      <TimelineInspector
        entries={[]}
        selectedIndex={0}
        selectedEntry={null}
        displayedSnapshot={null}
        selectedDiff={{ added: {}, removed: {}, changed: {} }}
        followLatest={false}
        displayLimit={null}
        onSelectEntry={vi.fn()}
        onFollowLatestChange={vi.fn()}
        onDisplayLimitChange={vi.fn()}
        onPrune={vi.fn()}
      />
    );
    expect(empty.container.textContent).toContain("No action selected.");
    const copyButton = Array.from(empty.container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Copy")
    );
    if (!copyButton) {
      throw new Error("missing copy button");
    }
    await click(copyButton);
    expect(execCommand).toHaveBeenCalledWith("copy");

    const snapshotTab = Array.from(empty.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Snapshot"
    );
    if (!snapshotTab) {
      throw new Error("missing snapshot tab");
    }
    await click(snapshotTab);
    expect(empty.container.textContent).toContain("No state available");
    await empty.unmount();
    execCommand.mockRestore();

    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("nope")) }
    });
    const failingCopy = await mount(
      <TimelineInspector
        entries={[createTimelineEntry()]}
        selectedIndex={0}
        selectedEntry={createTimelineEntry()}
        displayedSnapshot={snapshot}
        selectedDiff={diff}
        followLatest={false}
        displayLimit={null}
        onSelectEntry={vi.fn()}
        onFollowLatestChange={vi.fn()}
        onDisplayLimitChange={vi.fn()}
        onPrune={vi.fn()}
      />
    );
    const failingCopyButton = Array.from(failingCopy.container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Copy")
    );
    if (!failingCopyButton) {
      throw new Error("missing failing copy button");
    }
    await click(failingCopyButton);
    expect(failingCopy.container.textContent).toContain("Copy");
    await failingCopy.unmount();
  });

  it("renders timeline list outcomes and resize fallback branches", async () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    const originalSetTimeout = window.setTimeout;
    const originalClearTimeout = window.clearTimeout;
    const timeoutIds: number[] = [];

    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: undefined
    });
    window.setTimeout = ((callback: (...args: unknown[]) => void) => {
      callback();
      const id = timeoutIds.length + 1;
      timeoutIds.push(id);
      return id;
    }) as typeof window.setTimeout;
    window.clearTimeout = vi.fn() as unknown as typeof window.clearTimeout;

    expect(observeTimelineElementRect(null, vi.fn())).toBeUndefined();
    expect(observeTimelineElementOffset(null, vi.fn())).toBeUndefined();

    const onSelectEntry = vi.fn();
    const view = await mount(
      <TimelineList
        visibleEntries={[
          createTimelineEntry({
            id: "event-entry",
            kind: "event",
            label: "EVENT/custom",
            envelopeKind: "observation",
            meta: { machineId: "m1" }
          }),
          createTimelineEntry({
            id: "noop-entry",
            kind: "operation",
            label: "OP/noop",
            envelopeKind: "operationResult",
            meta: { machineId: "m1", transitioned: false }
          }),
          createTimelineEntry({
            id: "ok-entry",
            kind: "operation",
            label: "OP/ok",
            envelopeKind: "operationResult",
            meta: { machineId: "m1", transitioned: true }
          })
        ]}
        visibleStartIndex={2}
        selectedIndex={3}
        followLatest
        onSelectEntry={onSelectEntry}
      />
    );

    expect(view.container.textContent).toContain("EVENT/custom");
    expect(view.container.textContent).toContain("NOOP");
    expect(view.container.textContent).toContain("OK");

    const list = view.container.querySelector('[role="list"]') as HTMLDivElement | null;
    if (!list) {
      throw new Error("missing timeline list");
    }

    await act(async () => {
      list.dispatchEvent(new Event("scroll"));
      list.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("resize"));
    });
    expect(window.clearTimeout).toHaveBeenCalled();

    const selectedButton = Array.from(view.container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("OP/noop")
    );
    if (!selectedButton) {
      throw new Error("missing timeline row");
    }
    await click(selectedButton);
    expect(onSelectEntry).toHaveBeenCalledWith(3);

    await view.unmount();
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: originalResizeObserver
    });
    window.setTimeout = originalSetTimeout;
    window.clearTimeout = originalClearTimeout;
  });

  it("serializes circular copy payloads and resets clipboard feedback timers", async () => {
    vi.useFakeTimers();
    let serializationCount = 0;
    const payload = {
      toJSON: () => {
        serializationCount += 1;
        if (serializationCount > 1) {
          throw new Error("copy serialization failed");
        }
        return { renderable: true };
      }
    };
    const entry = createTimelineEntry({ actionPayload: payload });
    const view = await mount(
      <TimelineInspector
        entries={[entry]}
        selectedIndex={0}
        selectedEntry={entry}
        displayedSnapshot={snapshot}
        selectedDiff={diff}
        followLatest={false}
        displayLimit={null}
        onSelectEntry={vi.fn()}
        onFollowLatestChange={vi.fn()}
        onDisplayLimitChange={vi.fn()}
        onPrune={vi.fn()}
      />
    );
    const copyButton = Array.from(view.container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Copy")
    );
    if (!copyButton) {
      throw new Error("missing copy button");
    }

    await click(copyButton);
    await act(async () => Promise.resolve());
    expect(copyButton.textContent).toContain("Copied");
    await act(async () => vi.advanceTimersByTime(1200));
    expect(copyButton.textContent).toContain("Copy");

    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error("denied"));
    await click(copyButton);
    await act(async () => Promise.resolve());
    await act(async () => vi.advanceTimersByTime(1600));
    expect(copyButton.textContent).toContain("Copy");
    await view.unmount();
    vi.useRealTimers();
  });

  it("renders no-op action details without an action payload", async () => {
    const entry = createTimelineEntry({
      kind: "operation",
      envelopeKind: "operationResult",
      invocation: { operationId: "core.pause" },
      actionPayload: undefined,
      meta: { machineId: "m1", transitioned: false }
    });
    const view = await mount(
      <TimelineInspector
        entries={[entry]}
        selectedIndex={0}
        selectedEntry={entry}
        displayedSnapshot={snapshot}
        selectedDiff={diff}
        followLatest={false}
        displayLimit={null}
        onSelectEntry={vi.fn()}
        onFollowLatestChange={vi.fn()}
        onDisplayLimitChange={vi.fn()}
        onPrune={vi.fn()}
      />
    );
    expect(view.container.textContent).toContain("did not produce a transition");
    await view.unmount();
  });

  it("renders command controls validation, disabled, and option branches", async () => {
    const onInvoke = vi.fn();
    const features = [
      {
        id: "core",
        label: "Core",
        description: null,
        operations: [
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
            fields: [{ key: "stepId", label: "stepId", type: "text", required: true }]
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
            id: "core.clearStepError",
            label: "clearStepError",
            description: null,
            mutates: true,
            output: "snapshot",
            fields: [{ key: "stepId", label: "stepId", type: "text" }]
          },
          {
            id: "core.goToPreviousStep",
            label: "goToPreviousStep",
            description: null,
            mutates: true,
            output: "snapshot",
            fields: [{ key: "steps", label: "steps", type: "integer" }]
          },
          {
            id: "custom.inspect",
            label: "inspect",
            description: null,
            mutates: false,
            output: "data",
            fields: [{ key: "enabled", label: "enabled", type: "boolean" }]
          }
        ]
      }
    ] as const;

    const view = await mount(
      <CommandControls
        features={features}
        snapshotStatus="running"
        currentStepId="start"
        onInvoke={onInvoke}
        disabled={false}
        disabledReason={null}
        mutationsEnabled={false}
        mode="graph"
        stepIds={["start", "review"]}
        eventTypes={["custom"]}
        eventTypesBySource={{ start: ["custom"], "*": ["global"] }}
        goToStepTargetsBySource={{ start: ["review"], "*": ["start", "review"] }}
      />
    );

    expect(view.container.textContent).toContain("Mutations disabled");
    expect(view.container.textContent).toContain("Navigation");

    const goToStepButton = Array.from(view.container.querySelectorAll("button")).find(
      (button) => button.textContent === "goToStepById"
    );
    if (!goToStepButton) {
      throw new Error("missing goToStepById button");
    }
    expect(goToStepButton.disabled).toBe(true);

    const inspectButton = Array.from(view.container.querySelectorAll("button")).find(
      (button) => button.textContent === "inspect"
    );
    if (!inspectButton) {
      throw new Error("missing inspect button");
    }
    await click(inspectButton);
    expect(onInvoke).toHaveBeenCalledWith({
      operationId: "custom.inspect",
      input: { enabled: false }
    });
    await view.unmount();

    const enabledView = await mount(
      <CommandControls
        features={features}
        snapshotStatus="running"
        currentStepId="start"
        onInvoke={onInvoke}
        disabled={false}
        disabledReason={null}
        mutationsEnabled
        mode="headless"
        stepIds={[]}
        eventTypes={[]}
        eventTypesBySource={undefined}
        goToStepTargetsBySource={undefined}
      />
    );
    const sendButton = Array.from(enabledView.container.querySelectorAll("button")).find(
      (button) => button.textContent === "send"
    );
    if (!sendButton) {
      throw new Error("missing send button");
    }
    const textInputs = Array.from(enabledView.container.querySelectorAll("input"));
    const sendTypeInput = textInputs.find((input) => input.placeholder === "type");
    if (!sendTypeInput) {
      throw new Error("missing send type input");
    }
    await setInputValue(sendTypeInput, "custom");
    const payloadTextarea = enabledView.container.querySelector("textarea");
    if (!payloadTextarea) {
      throw new Error("missing payload textarea");
    }
    await setInputValue(payloadTextarea as HTMLTextAreaElement, "{bad");
    expect(enabledView.container.textContent).toContain("JSON fields must contain valid JSON");
    await setInputValue(payloadTextarea as HTMLTextAreaElement, '{"ok":true}');
    await click(sendButton);
    expect(onInvoke).toHaveBeenCalledWith({
      operationId: "core.sendEvent",
      input: { type: "custom", payload: { ok: true } }
    });
    await enabledView.unmount();
  });

  it("renders command control fallbacks, toggles, and optional inputs", async () => {
    const onInvoke = vi.fn();
    const featureWithFallbackOptions = [
      {
        id: "core",
        label: "Core",
        description: null,
        operations: [
          {
            id: "core.sendEvent",
            label: "send",
            description: null,
            mutates: true,
            output: "snapshot",
            fields: [{ key: "type", label: "type", type: "text", required: true }]
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
            id: "core.updateContext",
            label: "updateContext",
            description: null,
            mutates: true,
            output: "snapshot",
            fields: [{ key: "context", label: "context", type: "json" }]
          },
          {
            id: "custom.optional",
            label: "optional",
            description: null,
            mutates: false,
            output: "data",
            fields: [{ key: "count", label: "count", type: "integer" }]
          }
        ]
      }
    ] as const;

    const view = await mount(
      <CommandControls
        features={featureWithFallbackOptions}
        snapshotStatus="running"
        currentStepId="start"
        onInvoke={onInvoke}
        disabled
        disabledReason="Commands are unavailable"
        mutationsEnabled
        mode="graph"
        stepIds={["start", "review"]}
        eventTypes={["fallback"]}
        eventTypesBySource={undefined}
        goToStepTargetsBySource={undefined}
      />
    );

    expect(view.container.textContent).toContain("Commands are unavailable");
    const eventsToggle = Array.from(view.container.querySelectorAll("button")).find((button) =>
      button.getAttribute("aria-label")?.includes("Collapse Events")
    );
    if (!eventsToggle) {
      throw new Error("missing events toggle");
    }
    await click(eventsToggle);
    expect(view.container.textContent).not.toContain("clearStepError");
    await view.unmount();

    const enabledView = await mount(
      <CommandControls
        features={featureWithFallbackOptions}
        snapshotStatus="running"
        currentStepId="start"
        onInvoke={onInvoke}
        disabled={false}
        disabledReason={null}
        mutationsEnabled
        mode="graph"
        stepIds={["start", "review"]}
        eventTypes={["fallback"]}
        eventTypesBySource={undefined}
        goToStepTargetsBySource={undefined}
      />
    );

    const optionalButton = Array.from(enabledView.container.querySelectorAll("button")).find(
      (button) => button.textContent === "optional"
    );
    if (!optionalButton) {
      throw new Error("missing optional button");
    }
    await click(optionalButton);
    expect(onInvoke).toHaveBeenCalledWith({ operationId: "custom.optional" });

    const contextTextarea = enabledView.container.querySelector("textarea");
    if (!contextTextarea) {
      throw new Error("missing context textarea");
    }
    await setInputValue(contextTextarea as HTMLTextAreaElement, '{"updated":true}');
    const updateContextButton = Array.from(enabledView.container.querySelectorAll("button")).find(
      (button) => button.textContent === "updateContext"
    );
    if (!updateContextButton) {
      throw new Error("missing updateContext button");
    }
    await click(updateContextButton);
    expect(onInvoke).toHaveBeenCalledWith({
      operationId: "core.updateContext",
      input: { context: { updated: true } }
    });
    await enabledView.unmount();
  });

  it("renders standalone operation field and section card branches", async () => {
    const onChange = vi.fn();
    const booleanField = await mount(
      <OperationField
        operationId="custom.boolean"
        field={{ key: "enabled", label: "enabled", type: "boolean" }}
        value=""
        disabled={false}
        options={undefined}
        validationError="Required"
        onChange={onChange}
      />
    );
    const booleanSelect = booleanField.container.querySelector("select");
    if (!booleanSelect) {
      throw new Error("missing boolean select");
    }
    await setInputValue(booleanSelect as HTMLSelectElement, "true");
    expect(onChange).toHaveBeenCalledWith("custom.boolean:enabled", "true");
    await booleanField.unmount();

    const selectOnly = await mount(
      <OperationField
        operationId="custom.select"
        field={{ key: "stepId", label: "stepId", type: "text" }}
        value=""
        disabled={false}
        options={undefined}
        selectOnly
        validationError={null}
        onChange={onChange}
      />
    );
    expect(
      (selectOnly.container.querySelector("select") as HTMLSelectElement | null)?.disabled
    ).toBe(true);
    await selectOnly.unmount();

    const optionField = await mount(
      <OperationField
        operationId="custom.options"
        field={{ key: "target", label: "target", type: "text", placeholder: "Pick target" }}
        value=""
        disabled={false}
        options={["review"]}
        validationError="Invalid target"
        onChange={onChange}
      />
    );
    expect(optionField.container.textContent).toContain("review");
    expect(optionField.container.querySelector("select")?.getAttribute("aria-invalid")).toBe(
      "true"
    );
    const optionSelect = optionField.container.querySelector("select");
    if (!optionSelect) {
      throw new Error("missing option select");
    }
    await setInputValue(optionSelect, "review");
    expect(onChange).toHaveBeenCalledWith("custom.options:target", "review");
    await optionField.unmount();

    const textField = await mount(
      <OperationField
        operationId="custom.text"
        field={{ key: "name", label: "name", type: "text" }}
        value=""
        disabled={false}
        options={undefined}
        validationError="Name is invalid"
        onChange={onChange}
      />
    );
    expect(textField.container.textContent).toContain("Name is invalid");
    expect(textField.container.querySelector("input")?.getAttribute("aria-invalid")).toBe("true");
    await textField.unmount();

    const card = await mount(
      <OperationSectionCard
        section={{
          id: "custom",
          label: "Custom",
          description: "Custom operations",
          operations: []
        }}
        isOpen={false}
        onToggle={vi.fn()}
        errorMessage="Section failed"
      >
        <p>Hidden content</p>
      </OperationSectionCard>
    );
    expect(card.container.textContent).toContain("Custom operations");
    expect(card.container.textContent).toContain("Section failed");
    expect(card.container.textContent).not.toContain("Hidden content");
    await card.unmount();
  });

  it("renders compatibility notice for legacy protocol machines", async () => {
    panelProviderMocks.useActiveMachine.mockReturnValue({
      activeMachine: createMachineState({
        protocolVersion: JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION
      }),
      displayedSnapshot: snapshot,
      selectedTimelineEntry: createTimelineEntry(),
      selectedDiff: diff,
      protocolMismatchReason: "Legacy protocol mismatch",
      areCommandsDisabled: true,
      commandDisabledReason: "Legacy protocol mismatch"
    });
    panelProviderMocks.useLegacyProtocolState.mockReturnValue({
      protocolMismatchReason: "Legacy protocol mismatch",
      isLegacyProtocol: true
    });

    const view = await mount(<CompatibilityNotice />);
    expect(view.container.textContent).toContain("Legacy protocol mismatch");
    expect(view.container.textContent).toContain("Legacy protocol v3 machines are read-only");

    panelProviderMocks.useLegacyProtocolState.mockReturnValue({
      protocolMismatchReason: "Newer protocol mismatch",
      isLegacyProtocol: false
    });
    await view.rerender(<CompatibilityNotice />);
    expect(view.container.textContent).toContain("Newer protocol mismatch");
    expect(view.container.textContent).not.toContain("Legacy protocol v3 machines are read-only");
    await view.unmount();
  });

  it("returns no active panel and reports protocol compatibility helpers", async () => {
    const view = await mount(<ActiveMachinePanel />);
    expect(view.container.innerHTML).toBe("");
    expect(getProtocolMismatchReason(undefined)).toBeNull();
    expect(getProtocolMismatchReason(JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION)).toContain(
      "selected machine"
    );
    expect(isLegacyProtocolVersion(undefined)).toBe(false);
    expect(isLegacyProtocolVersion(JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION)).toBe(true);
    await view.unmount();
  });

  it("derives legacy linear controls when source maps are absent", async () => {
    const linearSnapshot = {
      ...snapshot,
      type: "linear",
      currentStep: null
    } as unknown as JourneyDevtoolsSerializableSnapshot;
    const metaWithoutStepIds = { ...createMachineState().meta };
    delete metaWithoutStepIds.stepIds;
    const machine = createMachineState({
      snapshot: linearSnapshot,
      meta: {
        ...metaWithoutStepIds,
        appName: null,
        mode: "linear"
      }
    });
    panelProviderMocks.useActiveMachine.mockReturnValue({
      activeMachine: machine,
      displayedSnapshot: linearSnapshot,
      selectedTimelineEntry: machine.timelineEntries[0],
      selectedDiff: diff,
      protocolMismatchReason: null,
      areCommandsDisabled: false,
      commandDisabledReason: null
    });

    const view = await mount(<ActiveMachinePanel />);
    expect(view.container.textContent).toContain("Operations");

    const machineWithSteps = createMachineState({
      snapshot: linearSnapshot,
      meta: { ...machine.meta, stepIds: ["start", "review"] }
    });
    panelProviderMocks.useActiveMachine.mockReturnValue({
      activeMachine: machineWithSteps,
      displayedSnapshot: linearSnapshot,
      selectedTimelineEntry: machineWithSteps.timelineEntries[0],
      selectedDiff: diff,
      protocolMismatchReason: null,
      areCommandsDisabled: false,
      commandDisabledReason: null
    });
    await view.rerender(<ActiveMachinePanel />);
    expect(view.container.textContent).toContain("Operations");
    await view.unmount();
  });

  it("renders event sections with either optional operation absent", async () => {
    const operation = (id: "core.sendEvent" | "core.clearStepError") => ({
      id,
      label: id,
      description: null,
      mutates: true,
      output: "snapshot" as const,
      fields: []
    });
    const renderControls = (id: "core.sendEvent" | "core.clearStepError") => (
      <CommandControls
        features={[{ id: "core", label: "Core", description: null, operations: [operation(id)] }]}
        snapshotStatus="running"
        currentStepId="start"
        onInvoke={vi.fn()}
        disabled={false}
        mutationsEnabled
        mode="graph"
        stepIds={[]}
        eventTypes={[]}
        eventTypesBySource={{}}
        goToStepTargetsBySource={{}}
      />
    );
    const view = await mount(renderControls("core.sendEvent"));
    expect(view.container.textContent).toContain("core.sendEvent");
    await view.rerender(renderControls("core.clearStepError"));
    expect(view.container.textContent).toContain("core.clearStepError");
    await view.unmount();
  });

  it("renders app shell and active machine panel through current provider hooks", async () => {
    const selectMachine = vi.fn();
    const selectTimelineEntry = vi.fn();
    const setFollowLatest = vi.fn();
    const setDisplayLimit = vi.fn();
    const pruneTimeline = vi.fn();
    const invokeOperation = vi.fn();
    const machine = createMachineState();

    panelProviderMocks.usePanelState.mockReturnValue({
      panelState: {
        connected: true,
        machines: { m1: machine },
        machineOrder: ["m1"],
        selectedMachineId: "m1",
        displayLimit: 50
      },
      connectionWarning: null,
      displayConnected: true,
      activeMachine: machine,
      displayedSnapshot: snapshot,
      selectedTimelineEntry: machine.timelineEntries[0],
      selectedDiff: diff,
      isCommandChannelReady: true,
      protocolMismatchReason: null,
      areCommandsDisabled: false,
      commandDisabledReason: null
    });
    panelProviderMocks.usePanelActions.mockReturnValue({
      selectMachine,
      selectTimelineEntry,
      setFollowLatest,
      setDisplayLimit,
      pruneTimeline,
      invokeOperation
    });
    panelProviderMocks.useActiveMachine.mockReturnValue({
      activeMachine: machine,
      displayedSnapshot: snapshot,
      selectedTimelineEntry: machine.timelineEntries[0],
      selectedDiff: diff,
      protocolMismatchReason: null,
      areCommandsDisabled: false,
      commandDisabledReason: null
    });

    const shell = await mount(<AppShell />);
    expect(shell.container.textContent).toContain("Journey Machines");
    expect(shell.container.textContent).toContain("Connected to inspected tab");
    await shell.unmount();

    const active = await mount(<ActiveMachinePanel />);
    expect(active.container.textContent).toContain("Timeline");
    expect(active.container.textContent).toContain("Operations");

    const timelineButton = active.container.querySelector('[role="listitem"] button');
    if (!timelineButton) {
      throw new Error("missing timeline item");
    }
    await click(timelineButton);
    expect(selectTimelineEntry).toHaveBeenCalledWith("m1", 0);

    const followButton = Array.from(active.container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Following latest")
    );
    const pruneButton = Array.from(active.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Prune to limit"
    );
    const limitInput = active.container.querySelector('input[type="number"]');
    if (!followButton || !pruneButton || !limitInput) {
      throw new Error("missing active timeline controls");
    }
    await click(followButton);
    await setInputValue(limitInput as HTMLInputElement, "12");
    await click(pruneButton);
    expect(setFollowLatest).toHaveBeenCalledWith("m1", false);
    expect(setDisplayLimit).toHaveBeenCalledWith(12);
    expect(pruneTimeline).toHaveBeenCalledWith("m1", 50);

    const operationButton = Array.from(active.container.querySelectorAll("button")).find(
      (button) => button.textContent === "goToNextStep"
    );
    if (!operationButton) {
      throw new Error("missing active operation");
    }
    await click(operationButton);
    expect(invokeOperation).toHaveBeenCalledWith("m1", {
      operationId: "core.goToNextStep"
    });
    await active.unmount();
  });
});
