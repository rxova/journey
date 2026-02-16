import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { JourneyDevtoolsSerializableSnapshot } from "@rxova/journey-devtools-bridge";
import { CommandControls } from "../src/panel/components/CommandControls";
import { ConnectionStatus } from "../src/panel/components/ConnectionStatus";
import { EventLog } from "../src/panel/components/EventLog";
import { JsonBlock } from "../src/panel/components/JsonBlock";
import { MachineSelector } from "../src/panel/components/MachineSelector";
import { SnapshotTabs } from "../src/panel/components/SnapshotTabs";

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
  current: "start",
  context: { attempts: 1 },
  history: ["start"],
  visited: ["start", "review"],
  status: "running",
  async: {
    isLoading: false,
    byStep: {
      start: { phase: "idle", eventType: null, transitionId: null, error: null }
    }
  }
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

    await view.unmount();
  });

  it("renders machine selector empty and populated states", async () => {
    const onSelect = vi.fn();
    const view = await mount(
      <MachineSelector
        machineOrder={[]}
        machines={{}}
        selectedMachineId={null}
        onSelect={onSelect}
      />
    );

    expect(view.container.textContent).toContain("No machines registered yet.");

    await view.rerender(
      <MachineSelector
        machineOrder={["m1", "missing", "m2"]}
        machines={{
          m1: {
            meta: { machineId: "m1", label: "Checkout", appName: "Store" },
            snapshot,
            logs: []
          },
          m2: {
            meta: { machineId: "m2", label: "Billing", appName: null },
            snapshot,
            logs: []
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

    await view.unmount();
  });

  it("serializes bigint values in JsonBlock", async () => {
    const view = await mount(<JsonBlock value={{ value: BigInt(42) }} />);
    expect(view.container.textContent).toContain('"42"');
    await view.unmount();
  });

  it("handles event log controls and rendering", async () => {
    const onDisplayLimitChange = vi.fn();
    const onPrune = vi.fn();

    const view = await mount(
      <EventLog
        logs={[
          { id: "1", timestamp: 1, kind: "register", summary: "Registered" },
          { id: "2", timestamp: 2, kind: "snapshot", summary: "Snapshot" }
        ]}
        totalCount={3}
        displayLimit={null}
        onDisplayLimitChange={onDisplayLimitChange}
        onPrune={onPrune}
      />
    );

    const input = view.container.querySelector('input[type="number"]') as HTMLInputElement;
    await setInputValue(input, "4");
    await setInputValue(input, "2.8");
    await setInputValue(input, "0");

    expect(onDisplayLimitChange).toHaveBeenCalledWith(4);
    expect(onDisplayLimitChange).toHaveBeenCalledWith(2);
    expect(onDisplayLimitChange).toHaveBeenCalledWith(1);

    await clickAndFlush(getButton(view.container, "Prune to limit"));
    expect(onPrune).toHaveBeenCalledTimes(1);

    await view.unmount();
  });

  it("switches snapshot tabs and renders each payload", async () => {
    const view = await mount(<SnapshotTabs snapshot={snapshot} />);

    expect(view.container.textContent).toContain('"current": "start"');

    await clickAndFlush(getButton(view.container, "Context"));
    expect(view.container.textContent).toContain('"attempts": 1');

    await clickAndFlush(getButton(view.container, "History"));
    expect(view.container.textContent).toContain('"start"');

    await clickAndFlush(getButton(view.container, "Visited"));
    expect(view.container.textContent).toContain('"review"');

    await clickAndFlush(getButton(view.container, "Async"));
    expect(view.container.textContent).toContain('"isLoading": false');

    await view.unmount();
  });

  it("dispatches command controls commands and validation errors", async () => {
    const onCommand = vi.fn();
    const view = await mount(<CommandControls onCommand={onCommand} disabled={false} />);

    await clickAndFlush(getButton(view.container, "next"));
    await clickAndFlush(getButton(view.container, "back"));
    await clickAndFlush(getButton(view.container, "close"));
    await clickAndFlush(getButton(view.container, "submit"));
    await clickAndFlush(getButton(view.container, "reset"));
    await clickAndFlush(getButton(view.container, "clearHistory"));

    const goToInput = view.container.querySelector(
      'input[placeholder="review"]'
    ) as HTMLInputElement;
    await clickAndFlush(getButton(view.container, "Send"));
    expect(view.container.textContent).toContain("Target step is required.");

    await setInputValue(goToInput, "review");
    await clickAndFlush(getButton(view.container, "Send"));

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

    await clickAndFlush(getButton(view.container, "Trim history"));
    await setInputValue(
      view.container.querySelector('input[placeholder="10"]') as HTMLInputElement,
      "abc"
    );
    await clickAndFlush(getButton(view.container, "Trim history"));
    expect(view.container.textContent).toContain("History limit must be a number.");

    await setInputValue(
      view.container.querySelector('input[placeholder="10"]') as HTMLInputElement,
      "10.9"
    );
    await clickAndFlush(getButton(view.container, "Trim history"));

    expect(onCommand).toHaveBeenCalledWith({ type: "next" });
    expect(onCommand).toHaveBeenCalledWith({ type: "back" });
    expect(onCommand).toHaveBeenCalledWith({ type: "close" });
    expect(onCommand).toHaveBeenCalledWith({ type: "submit" });
    expect(onCommand).toHaveBeenCalledWith({ type: "reset" });
    expect(onCommand).toHaveBeenCalledWith({ type: "clearHistory" });
    expect(onCommand).toHaveBeenCalledWith({ type: "goTo", to: "review" });
    expect(onCommand).toHaveBeenCalledWith({
      type: "send",
      event: { type: "retry", payload: { attempt: 2 } }
    });
    expect(onCommand).toHaveBeenCalledWith({ type: "clearStepError" });
    expect(onCommand).toHaveBeenCalledWith({ type: "clearStepError", stepId: "details" });
    expect(onCommand).toHaveBeenCalledWith({ type: "trimHistory" });
    expect(onCommand).toHaveBeenCalledWith({ type: "trimHistory", maxHistory: 10 });

    await view.rerender(<CommandControls onCommand={onCommand} disabled />);
    expect(getButton(view.container, "next").disabled).toBe(true);

    await view.unmount();
  });
});
