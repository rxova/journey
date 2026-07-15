import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION
} from "@rxova/journey-devtools-bridge";
import type { JourneyDevtoolsSerializableSnapshot } from "@rxova/journey-devtools-bridge";
import {
  INITIAL_SNAPSHOT,
  type JourneyPanelMachineState,
  type JourneyPanelState
} from "../src/panel/store";
import {
  PanelProvider,
  useActiveMachine,
  useLegacyProtocolState,
  usePanelActions,
  usePanelConnection,
  usePanelState,
  usePanelTimelineRetention
} from "../src/panel/context/PanelProvider";
import { usePanelBridge } from "../src/panel/hooks/usePanelBridge";

vi.mock("../src/panel/hooks/usePanelBridge", () => ({
  usePanelBridge: vi.fn()
}));

type MountedView = {
  container: HTMLDivElement;
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
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  };
};

const snapshot: JourneyDevtoolsSerializableSnapshot = {
  ...INITIAL_SNAPSHOT,
  type: "graph",
  currentStep: {
    id: "start",
    metadata: null,
    isFirstTimeVisit: true,
    async: { isLoading: false, isSuccess: true, isError: false, error: null },
    isTerminal: false
  },
  history: {
    timeline: ["start"],
    currentIndex: 0,
    visited: { start: true },
    canGoBack: false,
    canGoForward: false
  },
  context: { attempts: 1 },
  status: "running",
  machine: {
    isLoading: false,
    isIdle: false,
    isRunning: true,
    isPaused: false,
    isCompleted: false,
    isTerminated: false,
    outcome: null
  },
  steps: { totalSteps: 2, visitedStepCount: 1 },
  declaredEvents: ["submitLogin"],
  availableEvents: ["submitLogin"],
  availableSteps: ["review"],
  outgoingTransitions: [
    {
      event: "submitLogin",
      to: "review",
      priority: 0,
      guard: "none",
      enabled: true,
      selected: true
    }
  ]
};

const machine: JourneyPanelMachineState = {
  meta: {
    machineId: "machine-1",
    label: "Checkout",
    appName: "Store",
    mutationsEnabled: true,
    mode: "graph",
    stepIds: ["start", "review"],
    eventTypes: ["submitLogin"],
    features: []
  },
  protocolVersion: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  snapshot,
  timelineEntries: [],
  selectedTimelineIndex: 0,
  followLatest: true,
  pendingCommandsByRequestId: {}
};

const panelState: JourneyPanelState = {
  connected: true,
  machines: { "machine-1": machine },
  machineOrder: ["machine-1"],
  selectedMachineId: "machine-1",
  displayLimit: 25
};

const HookProbe = () => {
  const state = usePanelState();
  const actions = usePanelActions();
  const connection = usePanelConnection();
  const active = useActiveMachine();
  const legacy = useLegacyProtocolState();
  const retention = usePanelTimelineRetention();

  return (
    <pre>
      {JSON.stringify({
        stateMachineId: state.activeMachine?.meta.machineId ?? null,
        connection: {
          displayConnected: connection.displayConnected,
          isCommandChannelReady: connection.isCommandChannelReady
        },
        active: {
          currentStepId: active.displayedSnapshot?.currentStep?.id ?? null,
          disabled: active.areCommandsDisabled,
          reason: active.commandDisabledReason
        },
        legacy,
        retention,
        actionKeys: Object.keys(actions).sort()
      })}
    </pre>
  );
};

const MissingProviderProbe = () => {
  usePanelState();
  return null;
};

describe("panel context hooks", () => {
  beforeEach(() => {
    vi.mocked(usePanelBridge).mockReturnValue({
      panelState,
      connectionWarning: null,
      displayConnected: true,
      isCommandChannelReady: true,
      invokeOperation: vi.fn(),
      selectMachine: vi.fn(),
      selectTimelineEntry: vi.fn(),
      setFollowLatest: vi.fn(),
      setDisplayLimit: vi.fn(),
      pruneTimeline: vi.fn()
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("exposes derived provider state through the helper hooks", async () => {
    const view = await mount(
      <PanelProvider>
        <HookProbe />
      </PanelProvider>
    );

    expect(view.container.textContent).toContain('"stateMachineId":"machine-1"');
    expect(view.container.textContent).toContain('"displayConnected":true');
    expect(view.container.textContent).toContain('"currentStepId":"start"');
    expect(view.container.textContent).toContain('"retention":2000');
    expect(view.container.textContent).toContain('"isLegacyProtocol":false');
    expect(view.container.textContent).toContain(
      '"actionKeys":["invokeOperation","pruneTimeline","selectMachine","selectTimelineEntry","setDisplayLimit","setFollowLatest"]'
    );

    await view.unmount();
  });

  it("reports legacy protocol mismatches through the dedicated hook", async () => {
    vi.mocked(usePanelBridge).mockReturnValue({
      panelState: {
        ...panelState,
        machines: {
          "machine-1": {
            ...machine,
            protocolVersion: JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION
          }
        }
      },
      connectionWarning: null,
      displayConnected: true,
      isCommandChannelReady: true,
      invokeOperation: vi.fn(),
      selectMachine: vi.fn(),
      selectTimelineEntry: vi.fn(),
      setFollowLatest: vi.fn(),
      setDisplayLimit: vi.fn(),
      pruneTimeline: vi.fn()
    });

    const view = await mount(
      <PanelProvider>
        <HookProbe />
      </PanelProvider>
    );

    expect(view.container.textContent).toContain('"isLegacyProtocol":true');
    expect(view.container.textContent).toContain("protocolMismatchReason");
    await view.unmount();
  });

  it("throws when a panel hook is used outside the provider", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    expect(() => {
      act(() => {
        root.render(<MissingProviderProbe />);
      });
    }).toThrow("usePanelState must be used within a PanelProvider.");

    act(() => {
      root.unmount();
    });
  });
});
