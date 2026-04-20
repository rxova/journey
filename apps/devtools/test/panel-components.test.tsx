import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  JourneyDevtoolsMachineCapabilities,
  JourneyDevtoolsSerializableSnapshot
} from "@rxova/journey-devtools-bridge";
import type { JourneyPanelStructuredDiff } from "../src/panel/diff";
import { CommandControls } from "../src/panel/components/CommandControls";
import { ConnectionStatus } from "../src/panel/components/ConnectionStatus";
import { JsonBlock } from "../src/panel/components/JsonBlock";
import { JourneyMachineSelector } from "../src/panel/components/JourneyMachineSelector";
import { SectionErrorBoundary } from "../src/panel/components/SectionErrorBoundary";
import { TimelineInspector } from "../src/panel/components/TimelineInspector";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const getButton = (container: HTMLElement, label: string): HTMLButtonElement => {
  const button = Array.from(container.querySelectorAll("button")).find(
    (entry) => entry.textContent?.trim() === label
  );
  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }
  return button as HTMLButtonElement;
};

const clickAndFlush = async (element: HTMLElement) => {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

const setInputValue = async (
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
) => {
  await act(async () => {
    if (element instanceof HTMLSelectElement) {
      const selectSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value"
      )?.set;
      selectSetter?.call(element, value);
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    const fieldSetter = Object.getOwnPropertyDescriptor(
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      "value"
    )?.set;

    fieldSetter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
};

const snapshot: JourneyDevtoolsSerializableSnapshot = {
  currentStepId: "start",
  history: {
    timeline: ["start", "review"],
    index: 0
  },
  context: { attempts: 1 },
  visited: { start: true, review: true },
  status: "running",
  async: {
    isLoading: false,
    byStep: {
      start: { phase: "idle", eventType: null, transitionId: null, error: null }
    }
  }
};

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

const allAvailableCommands: JourneyDevtoolsMachineCapabilities["commands"] = [
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
];

const defaultCapabilities: JourneyDevtoolsMachineCapabilities = {
  commands: [...allAvailableCommands],
  observe: true as const,
  executionPaths: true
};

const createTimelineEntry = (index: number) => {
  const kind: "init" | "snapshot" = index === 0 ? "init" : "snapshot";
  const envelopeKind: "register" | "snapshot" = index === 0 ? "register" : "snapshot";

  return {
    id: `${index}`,
    timestamp: index,
    kind,
    label: index === 0 ? "@@INIT" : `SNAPSHOT/${index}`,
    requestId: null,
    command: null,
    envelopeKind,
    snapshot: {
      ...snapshot,
      currentStepId: index === 0 ? "start" : `step-${index}`,
      history: {
        ...snapshot.history,
        index: Math.min(index, snapshot.history.timeline.length - 1)
      }
    },
    actionPayload: { type: index === 0 ? "@@INIT" : `SNAPSHOT/${index}` },
    meta: { machineId: "m1" }
  };
};

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("panel components", () => {
  it("renders connection status variants", async () => {
    const view = await mount(<ConnectionStatus connected={false} warning={null} />);
    expect(view.container.textContent).toContain("Waiting for bridge messages");

    await view.rerender(
      <ConnectionStatus
        connected
        warning={{
          code: "injection-failed",
          message: "Injection failed",
          tabId: 1,
          recoverable: true
        }}
      />
    );
    expect(view.container.textContent).toContain("Connected to inspected tab");
    expect(view.container.textContent).toContain("Injection failed");
    expect(view.container.textContent).toContain(
      "Reload the inspected tab and keep the Journey panel open to retry injection."
    );

    await view.rerender(
      <ConnectionStatus
        connected
        warning={{
          code: "injection-failed",
          message: "Cannot access contents of the page",
          tabId: 1,
          recoverable: true
        }}
      />
    );
    expect(view.container.textContent).not.toContain(
      "The inspected URL is likely restricted (for example chrome:// pages)."
    );

    await view.rerender(
      <ConnectionStatus
        connected
        warning={{
          code: "injection-failed",
          message: "Unrecoverable failure",
          tabId: 1,
          recoverable: false
        }}
      />
    );
    expect(view.container.textContent).toContain(
      "Injection failed in this tab context and may not be recoverable."
    );

    await view.rerender(
      <ConnectionStatus
        connected
        warning={{
          code: "injection-missing-entry",
          message: "Missing bridge entry",
          tabId: 1,
          recoverable: false
        }}
      />
    );
    expect(view.container.textContent).toContain(
      "Verify the extension build output includes the content bridge entry."
    );

    await view.rerender(
      <ConnectionStatus
        connected
        warning={{
          code: "injection-unavailable",
          message: "Unavailable",
          tabId: 1,
          recoverable: false
        }}
      />
    );
    expect(view.container.textContent).toContain(
      "This browser context does not support dynamic script injection for the inspected tab."
    );

    const unknownWarning = {
      code: "unknown-warning",
      message: "Unexpected warning",
      tabId: 1,
      recoverable: true
    } as unknown as React.ComponentProps<typeof ConnectionStatus>["warning"];
    await view.rerender(<ConnectionStatus connected warning={unknownWarning} />);
    expect(view.container.textContent).toContain("Unexpected warning");
    expect(view.container.querySelector(".status-guidance")).toBeNull();

    await view.unmount();
  });

  it("renders machine selector empty and populated states", async () => {
    const onSelect = vi.fn();
    const view = await mount(
      <JourneyMachineSelector
        machineOrder={[]}
        machines={{}}
        selectedMachineId={null}
        onSelect={onSelect}
      />
    );

    expect(view.container.textContent).toContain("No journey machines registered yet.");

    await view.rerender(
      <JourneyMachineSelector
        machineOrder={["m1", "missing", "m2"]}
        machines={{
          m1: {
            meta: {
              machineId: "m1",
              label: "Checkout",
              appName: "Store",
              commandsEnabled: true,
              capabilities: defaultCapabilities
            },
            snapshot,
            timelineEntries: [],
            selectedTimelineIndex: 0,
            followLatest: true,
            pendingCommandsByRequestId: {}
          },
          m2: {
            meta: {
              machineId: "m2",
              label: "Billing",
              appName: null,
              commandsEnabled: true,
              capabilities: defaultCapabilities
            },
            snapshot,
            timelineEntries: [],
            selectedTimelineIndex: 0,
            followLatest: true,
            pendingCommandsByRequestId: {}
          }
        }}
        selectedMachineId={"m1"}
        onSelect={onSelect}
      />
    );

    const select = view.container.querySelector("select") as HTMLSelectElement;
    expect(select).toBeTruthy();

    await setInputValue(select, "m2");
    expect(onSelect).toHaveBeenCalledWith("m2");
    expect(view.container.textContent).toContain("Checkout (Store)");
    expect(view.container.textContent).toContain("Billing");

    await view.rerender(
      <JourneyMachineSelector
        machineOrder={["m1", "m2"]}
        machines={{
          m1: {
            meta: {
              machineId: "m1",
              label: "Checkout",
              appName: "Store",
              commandsEnabled: true,
              capabilities: defaultCapabilities
            },
            snapshot,
            timelineEntries: [],
            selectedTimelineIndex: 0,
            followLatest: true,
            pendingCommandsByRequestId: {}
          },
          m2: {
            meta: {
              machineId: "m2",
              label: "Billing",
              appName: null,
              commandsEnabled: true,
              capabilities: defaultCapabilities
            },
            snapshot,
            timelineEntries: [],
            selectedTimelineIndex: 0,
            followLatest: true,
            pendingCommandsByRequestId: {}
          }
        }}
        selectedMachineId={null}
        onSelect={onSelect}
      />
    );
    const emptySelection = view.container.querySelector("select") as HTMLSelectElement;
    expect(emptySelection.value).toBe("m1");

    await view.unmount();
  });

  it("serializes bigint values in JsonBlock", async () => {
    const view = await mount(<JsonBlock value={{ value: BigInt(42) }} />);
    expect(view.container.textContent).toContain('"42"');
    await view.unmount();
  });

  it("renders section fallback UI and retries after a render error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let shouldThrow = true;

    const FailingSection = () => {
      if (shouldThrow) {
        throw new Error("section exploded");
      }
      return <p>Section recovered</p>;
    };

    const view = await mount(
      <SectionErrorBoundary section="Timeline">
        <FailingSection />
      </SectionErrorBoundary>
    );

    expect(view.container.textContent).toContain("Timeline");
    expect(view.container.textContent).toContain("section exploded");

    shouldThrow = false;
    await clickAndFlush(getButton(view.container, "Retry"));

    expect(view.container.textContent).toContain("Section recovered");
    consoleError.mockRestore();
    await view.unmount();
  });

  it("handles timeline inspector controls and tab payloads", async () => {
    const onSelectEntry = vi.fn();
    const onFollowLatestChange = vi.fn();
    const onDisplayLimitChange = vi.fn();
    const onPrune = vi.fn();

    const entries = [
      {
        id: "1",
        timestamp: 1,
        kind: "init" as const,
        label: "@@INIT",
        requestId: null,
        command: null,
        envelopeKind: "register" as const,
        snapshot,
        actionPayload: { type: "@@INIT" },
        meta: { machineId: "m1" }
      },
      {
        id: "2",
        timestamp: 2,
        kind: "snapshot" as const,
        label: "SNAPSHOT/review",
        requestId: null,
        command: null,
        envelopeKind: "snapshot" as const,
        snapshot: {
          ...snapshot,
          currentStepId: "review",
          history: { ...snapshot.history, index: 1 }
        },
        actionPayload: { type: "SNAPSHOT/review" },
        meta: { machineId: "m1" }
      }
    ];
    const selectedEntry = entries[1];
    if (!selectedEntry) {
      throw new Error("expected second timeline entry");
    }

    const view = await mount(
      <TimelineInspector
        entries={entries}
        selectedIndex={1}
        selectedEntry={selectedEntry}
        displayedSnapshot={selectedEntry.snapshot}
        selectedDiff={diff}
        followLatest={true}
        displayLimit={5}
        onSelectEntry={onSelectEntry}
        onFollowLatestChange={onFollowLatestChange}
        onDisplayLimitChange={onDisplayLimitChange}
        onPrune={onPrune}
      />
    );

    expect(view.container.textContent).toContain("Showing 2 / 2");
    expect(view.container.textContent).toContain("SNAPSHOT/review");

    const initTimelineLabel = Array.from(view.container.querySelectorAll(".timeline-label")).find(
      (entry) => entry.textContent?.trim() === "@@INIT"
    );
    if (!initTimelineLabel) {
      throw new Error("timeline @@INIT label not found");
    }
    const initTimelineRow = initTimelineLabel.closest("button");
    if (!initTimelineRow) {
      throw new Error("timeline @@INIT button not found");
    }
    await clickAndFlush(initTimelineRow);
    expect(onSelectEntry).toHaveBeenCalledWith(0);

    await clickAndFlush(getButton(view.container, "Following latest"));
    expect(onFollowLatestChange).toHaveBeenCalledWith(false);

    const input = view.container.querySelector('input[type="number"]') as HTMLInputElement;
    await setInputValue(input, "");
    expect(onDisplayLimitChange).toHaveBeenCalledWith(null);

    const finiteSpy = vi.spyOn(Number, "isFinite").mockReturnValueOnce(false);
    await setInputValue(input, "4");
    expect(onDisplayLimitChange).not.toHaveBeenCalledWith(4);
    finiteSpy.mockRestore();

    await setInputValue(input, "4");
    await setInputValue(input, "2.8");
    await setInputValue(input, "0");
    expect(onDisplayLimitChange).toHaveBeenCalledWith(4);
    expect(onDisplayLimitChange).toHaveBeenCalledWith(2);
    expect(onDisplayLimitChange).toHaveBeenCalledWith(1);

    await clickAndFlush(getButton(view.container, "Prune to limit"));
    expect(onPrune).toHaveBeenCalledTimes(1);

    await clickAndFlush(getButton(view.container, "Snapshot"));
    expect(view.container.textContent).toContain('"currentStepId": "review"');

    await clickAndFlush(getButton(view.container, "Diff"));
    expect(view.container.textContent).toContain('"context.attempts"');
    expect(view.container.textContent).toContain('"context.newFlag"');

    await view.unmount();
  });

  it("auto-scrolls to the newest row while follow-latest is enabled", async () => {
    const initialEntries = Array.from({ length: 20 }, (_, index) => createTimelineEntry(index));
    const nextEntries = Array.from({ length: 80 }, (_, index) => createTimelineEntry(index));
    const firstEntry = initialEntries[0];
    const selectedEntry = nextEntries[nextEntries.length - 1];
    if (!firstEntry || !selectedEntry) {
      throw new Error("expected timeline entries");
    }

    const view = await mount(
      <TimelineInspector
        entries={initialEntries}
        selectedIndex={0}
        selectedEntry={firstEntry}
        displayedSnapshot={firstEntry.snapshot}
        selectedDiff={diff}
        followLatest={true}
        displayLimit={null}
        onSelectEntry={vi.fn()}
        onFollowLatestChange={vi.fn()}
        onDisplayLimitChange={vi.fn()}
        onPrune={vi.fn()}
      />
    );

    const timelineList = view.container.querySelector(".timeline-list") as HTMLDivElement | null;
    if (!timelineList) {
      throw new Error("timeline list not found");
    }
    Object.defineProperty(timelineList, "clientHeight", {
      configurable: true,
      value: 320
    });
    Object.defineProperty(timelineList, "scrollHeight", {
      configurable: true,
      value: 1200
    });
    timelineList.scrollTop = 0;

    await view.rerender(
      <TimelineInspector
        entries={nextEntries}
        selectedIndex={nextEntries.length - 1}
        selectedEntry={selectedEntry}
        displayedSnapshot={selectedEntry.snapshot}
        selectedDiff={diff}
        followLatest={true}
        displayLimit={null}
        onSelectEntry={vi.fn()}
        onFollowLatestChange={vi.fn()}
        onDisplayLimitChange={vi.fn()}
        onPrune={vi.fn()}
      />
    );

    expect(timelineList.scrollTop).toBeGreaterThan(0);

    await view.unmount();
  });

  it("virtualizes large timeline lists and updates the rendered window on scroll", async () => {
    const entries = Array.from({ length: 200 }, (_, index) => createTimelineEntry(index));
    const selectedEntry = entries[0];
    if (!selectedEntry) {
      throw new Error("expected selected timeline entry");
    }

    const view = await mount(
      <TimelineInspector
        entries={entries}
        selectedIndex={0}
        selectedEntry={selectedEntry}
        displayedSnapshot={selectedEntry.snapshot}
        selectedDiff={diff}
        followLatest={false}
        displayLimit={null}
        onSelectEntry={vi.fn()}
        onFollowLatestChange={vi.fn()}
        onDisplayLimitChange={vi.fn()}
        onPrune={vi.fn()}
      />
    );

    const timelineList = view.container.querySelector(".timeline-list") as HTMLDivElement | null;
    if (!timelineList) {
      throw new Error("timeline list not found");
    }
    Object.defineProperty(timelineList, "clientHeight", {
      configurable: true,
      value: 320
    });

    expect(view.container.querySelectorAll(".timeline-item").length).toBeLessThan(200);
    expect(
      Array.from(view.container.querySelectorAll(".timeline-label")).some(
        (entry) => entry.textContent?.trim() === "SNAPSHOT/199"
      )
    ).toBe(false);

    await act(async () => {
      timelineList.scrollTop = 48 * 190;
      timelineList.dispatchEvent(new Event("scroll", { bubbles: true }));
    });

    expect(
      Array.from(view.container.querySelectorAll(".timeline-label")).some(
        (entry) => entry.textContent?.trim() === "SNAPSHOT/199"
      )
    ).toBe(true);

    await view.unmount();
  });

  it("renders and virtualizes when ResizeObserver is unavailable", async () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    delete (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;

    const firstEntry = createTimelineEntry(0);
    const view = await mount(
      <TimelineInspector
        entries={[firstEntry]}
        selectedIndex={0}
        selectedEntry={firstEntry}
        displayedSnapshot={firstEntry.snapshot}
        selectedDiff={diff}
        followLatest={false}
        displayLimit={null}
        onSelectEntry={vi.fn()}
        onFollowLatestChange={vi.fn()}
        onDisplayLimitChange={vi.fn()}
        onPrune={vi.fn()}
      />
    );

    const timelineList = view.container.querySelector(".timeline-list") as HTMLDivElement | null;
    if (!timelineList) {
      throw new Error("timeline list not found");
    }
    Object.defineProperty(timelineList, "clientHeight", {
      configurable: true,
      value: 320
    });

    expect(view.container.textContent).toContain("Showing 1 / 1");
    expect(view.container.querySelectorAll(".timeline-item").length).toBeGreaterThan(0);

    if (originalResizeObserver) {
      globalThis.ResizeObserver = originalResizeObserver;
    }
    await view.unmount();
  });

  it("renders and virtualizes when ResizeObserver is available", async () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientHeight"
    );

    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return this.classList?.contains("timeline-list") ? 320 : 0;
      }
    });

    globalThis.ResizeObserver = class {
      constructor() {}

      observe() {}

      unobserve() {}

      disconnect() {}
    } as unknown as typeof ResizeObserver;

    const firstEntry = createTimelineEntry(0);
    const secondEntry = createTimelineEntry(1);
    const view = await mount(
      <TimelineInspector
        entries={[firstEntry, secondEntry]}
        selectedIndex={1}
        selectedEntry={secondEntry}
        displayedSnapshot={secondEntry.snapshot}
        selectedDiff={diff}
        followLatest={false}
        displayLimit={null}
        onSelectEntry={vi.fn()}
        onFollowLatestChange={vi.fn()}
        onDisplayLimitChange={vi.fn()}
        onPrune={vi.fn()}
      />
    );

    expect(view.container.textContent).toContain("Showing 2 / 2");
    expect(view.container.querySelectorAll(".timeline-item").length).toBeGreaterThan(0);

    await view.unmount();

    if (clientHeightDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "clientHeight", clientHeightDescriptor);
    }
    if (originalResizeObserver) {
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  it("renders an empty timeline state without attempting row measurement", async () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    delete (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;

    const view = await mount(
      <TimelineInspector
        entries={[]}
        selectedIndex={0}
        selectedEntry={null}
        displayedSnapshot={null}
        selectedDiff={diff}
        followLatest={false}
        displayLimit={null}
        onSelectEntry={vi.fn()}
        onFollowLatestChange={vi.fn()}
        onDisplayLimitChange={vi.fn()}
        onPrune={vi.fn()}
      />
    );

    expect(view.container.textContent).toContain("Showing 0 / 0");

    if (originalResizeObserver) {
      globalThis.ResizeObserver = originalResizeObserver;
    }
    await view.unmount();
  });

  it("shows fallback payloads when no action or state is selected", async () => {
    const entries = [
      {
        id: "1",
        timestamp: 1,
        kind: "init" as const,
        label: "@@INIT",
        requestId: null,
        command: null,
        envelopeKind: "register" as const,
        snapshot,
        actionPayload: { type: "@@INIT" },
        meta: { machineId: "m1" }
      }
    ];

    const view = await mount(
      <TimelineInspector
        entries={entries}
        selectedIndex={0}
        selectedEntry={null}
        displayedSnapshot={null}
        selectedDiff={diff}
        followLatest={false}
        displayLimit={null}
        onSelectEntry={vi.fn()}
        onFollowLatestChange={vi.fn()}
        onDisplayLimitChange={vi.fn()}
        onPrune={vi.fn()}
      />
    );

    expect(view.container.textContent).toContain("No action selected.");

    await clickAndFlush(getButton(view.container, "Snapshot"));
    expect(view.container.textContent).toContain("No state available for this timeline entry.");

    await view.unmount();
  });

  it("dispatches command controls commands and validation errors", async () => {
    const onCommand = vi.fn();
    const view = await mount(
      <CommandControls
        availableCommands={allAvailableCommands}
        snapshotStatus="running"
        onCommand={onCommand}
        disabled={false}
      />
    );

    await clickAndFlush(getButton(view.container, "goToNextStep"));
    await clickAndFlush(getButton(view.container, "terminateJourney"));
    await clickAndFlush(getButton(view.container, "completeJourney"));
    await clickAndFlush(getButton(view.container, "resetJourney"));
    const lastVisitedButton = getButton(view.container, "goToLastVisitedStep");
    expect(lastVisitedButton.closest(".button-grid")).not.toBeNull();
    await clickAndFlush(lastVisitedButton);

    const goToInput = view.container.querySelector(
      'input[placeholder="review"]'
    ) as HTMLInputElement;
    await clickAndFlush(getButton(view.container, "Send goToStepById"));
    expect(view.container.textContent).toContain("Target step is required.");

    await setInputValue(goToInput, "review");
    await clickAndFlush(getButton(view.container, "Send goToStepById"));

    await clickAndFlush(getButton(view.container, "Send custom event"));
    expect(view.container.textContent).toContain("Event type is required.");

    await setInputValue(
      view.container.querySelector('input[placeholder="retry"]') as HTMLInputElement,
      "retry"
    );
    const payloadField = view.container.querySelector("textarea") as HTMLTextAreaElement;
    await setInputValue(payloadField, "not-json");
    await clickAndFlush(getButton(view.container, "Send custom event"));
    expect(view.container.textContent).toContain("Payload must be valid JSON.");

    await setInputValue(payloadField, '{"attempt":2}');
    await clickAndFlush(getButton(view.container, "Send custom event"));

    await clickAndFlush(getButton(view.container, "Clear error"));
    await setInputValue(
      view.container.querySelector('input[placeholder="details"]') as HTMLInputElement,
      "details"
    );
    await clickAndFlush(getButton(view.container, "Clear error"));

    await clickAndFlush(getButton(view.container, "Send previous"));
    await setInputValue(
      view.container.querySelector('input[placeholder="1"]') as HTMLInputElement,
      "abc"
    );
    await clickAndFlush(getButton(view.container, "Send previous"));
    expect(view.container.textContent).toContain("Step count must be a positive integer.");

    await setInputValue(
      view.container.querySelector('input[placeholder="1"]') as HTMLInputElement,
      "10.9"
    );
    await clickAndFlush(getButton(view.container, "Send previous"));

    const sectionTitles = Array.from(view.container.querySelectorAll("h2")).map((node) =>
      node.textContent?.trim()
    );
    expect(sectionTitles).toContain("Machine Commands");
    expect(sectionTitles).toContain("Navigation Commands");
    expect(sectionTitles).toContain("Events");
    expect(sectionTitles).not.toContain("Commands");
    expect(onCommand).toHaveBeenCalledWith({ type: "goToNextStep" });
    expect(onCommand).toHaveBeenCalledWith({ type: "terminateJourney" });
    expect(onCommand).toHaveBeenCalledWith({ type: "completeJourney" });
    expect(onCommand).toHaveBeenCalledWith({ type: "resetJourney" });
    expect(onCommand).toHaveBeenCalledWith({ type: "goToLastVisitedStep" });
    expect(onCommand).toHaveBeenCalledWith({ type: "goToStepById", stepId: "review" });
    expect(onCommand).toHaveBeenCalledWith({
      type: "send",
      event: { type: "retry", payload: { attempt: 2 } }
    });
    expect(onCommand).toHaveBeenCalledWith({ type: "clearStepError" });
    expect(onCommand).toHaveBeenCalledWith({ type: "clearStepError", stepId: "details" });
    expect(onCommand).toHaveBeenCalledWith({ type: "goToPreviousStep" });
    expect(onCommand).toHaveBeenCalledWith({ type: "goToPreviousStep", steps: 10 });

    await view.rerender(
      <CommandControls
        availableCommands={allAvailableCommands}
        snapshotStatus="running"
        onCommand={onCommand}
        disabled
      />
    );
    expect(getButton(view.container, "goToNextStep").disabled).toBe(true);

    await view.unmount();
  });

  it("limits machine commands by journey status", async () => {
    const onCommand = vi.fn();
    const withStart: JourneyDevtoolsMachineCapabilities["commands"] = [
      "startJourney",
      ...allAvailableCommands
    ];
    const view = await mount(
      <CommandControls
        availableCommands={withStart}
        snapshotStatus="running"
        onCommand={onCommand}
        disabled={false}
      />
    );

    expect(getButton(view.container, "startJourney").disabled).toBe(true);
    expect(getButton(view.container, "terminateJourney").disabled).toBe(false);
    expect(getButton(view.container, "completeJourney").disabled).toBe(false);
    expect(getButton(view.container, "resetJourney").disabled).toBe(false);

    await view.rerender(
      <CommandControls
        availableCommands={withStart}
        snapshotStatus="terminated"
        onCommand={onCommand}
        disabled={false}
      />
    );

    expect(getButton(view.container, "startJourney").disabled).toBe(true);
    expect(getButton(view.container, "terminateJourney").disabled).toBe(true);
    expect(getButton(view.container, "completeJourney").disabled).toBe(true);
    expect(getButton(view.container, "resetJourney").disabled).toBe(false);
    expect(view.container.textContent).not.toContain("goToNextStep");

    await view.unmount();
  });

  it("collapses machine commands, events, and timeline sections", async () => {
    const onCommand = vi.fn();
    const withStart: JourneyDevtoolsMachineCapabilities["commands"] = [
      "startJourney",
      ...allAvailableCommands
    ];
    const commandsView = await mount(
      <CommandControls
        availableCommands={withStart}
        snapshotStatus="idled"
        onCommand={onCommand}
        disabled={false}
      />
    );

    expect(commandsView.container.textContent).toContain("startJourney");
    expect(commandsView.container.textContent).toContain("Send custom event");

    const machineToggle = commandsView.container.querySelector(
      'button[aria-label="Collapse Machine Commands"]'
    ) as HTMLButtonElement | null;
    const eventsToggle = commandsView.container.querySelector(
      'button[aria-label="Collapse Events"]'
    ) as HTMLButtonElement | null;
    if (!machineToggle || !eventsToggle) {
      throw new Error("expected command section toggles");
    }

    await clickAndFlush(machineToggle);
    expect(commandsView.container.textContent).not.toContain("startJourney");

    await clickAndFlush(eventsToggle);
    expect(commandsView.container.textContent).not.toContain("Send custom event");

    await commandsView.unmount();

    const firstEntry = createTimelineEntry(0);
    const timelineView = await mount(
      <TimelineInspector
        entries={[firstEntry]}
        selectedIndex={0}
        selectedEntry={firstEntry}
        displayedSnapshot={firstEntry.snapshot}
        selectedDiff={diff}
        followLatest={false}
        displayLimit={null}
        onSelectEntry={vi.fn()}
        onFollowLatestChange={vi.fn()}
        onDisplayLimitChange={vi.fn()}
        onPrune={vi.fn()}
      />
    );

    expect(timelineView.container.textContent).toContain("Follow latest");
    const timelineToggle = timelineView.container.querySelector(
      'button[aria-label="Collapse Timeline"]'
    ) as HTMLButtonElement | null;
    if (!timelineToggle) {
      throw new Error("expected timeline toggle");
    }

    await clickAndFlush(timelineToggle);
    expect(timelineView.container.textContent).not.toContain("Follow latest");
    expect(timelineView.container.textContent).not.toContain("Action");

    await timelineView.unmount();
  });

  it("renders empty command controls state when no commands are exposed", async () => {
    const onCommand = vi.fn();
    const view = await mount(
      <CommandControls
        availableCommands={[]}
        snapshotStatus="idled"
        onCommand={onCommand}
        disabled={false}
      />
    );

    expect(view.container.textContent).toContain("No remote actions are exposed for this machine.");
    expect(view.container.textContent).not.toContain("Query execution paths");

    await view.unmount();
  });

  it("catches rendering errors and allows retry via SectionErrorBoundary", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    let shouldThrow = true;
    const Bomb = () => {
      if (shouldThrow) {
        throw new Error("boom");
      }
      return <div data-testid="child">ok</div>;
    };

    const container = document.createElement("div");
    document.body.appendChild(container);

    // Suppress the uncaught error report React 19 DEV mode fires for caught errors
    const errorHandler = (event: ErrorEvent) => {
      event.preventDefault();
    };
    window.addEventListener("error", errorHandler);

    const root: Root = createRoot(container, {
      onCaughtError: () => {
        // expected — error boundary caught the render error
      }
    });

    root.render(
      <SectionErrorBoundary section="Test">
        <Bomb />
      </SectionErrorBoundary>
    );

    await new Promise((resolve) => setTimeout(resolve, 16));

    expect(container.textContent).toContain("Test — Error");
    expect(container.textContent).toContain("boom");

    const retryButton = container.querySelector(".retry-button") as HTMLButtonElement;
    expect(retryButton).toBeTruthy();

    shouldThrow = false;
    retryButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 16));

    expect(container.querySelector("[data-testid='child']")?.textContent).toBe("ok");

    window.removeEventListener("error", errorHandler);
    root.unmount();
    container.remove();
    consoleError.mockRestore();
  });
});
