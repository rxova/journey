import React from "react";

import {
  JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  type JourneyDevtoolsCommand,
  type JourneyDevtoolsProtocolVersion
} from "@rxova/journey-devtools-bridge";
import { CommandControls } from "./components/CommandControls";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { JourneyMachineSelector } from "./components/JourneyMachineSelector";
import { SectionErrorBoundary } from "./components/SectionErrorBoundary";
import { TimelineInspector } from "./components/TimelineInspector";
import {
  MAX_MACHINE_TIMELINE_ENTRIES,
  createInitialPanelState,
  panelReducer,
  selectActiveMachine,
  selectDisplayedSnapshot,
  selectSelectedDiff,
  selectSelectedTimelineEntry
} from "./store";
import {
  JOURNEY_DEVTOOLS_PANEL_PORT,
  createCommandEnvelope,
  isBackgroundToPanelMessage,
  type BackgroundToPanelMessage,
  type PanelWarning,
  type PanelCommandMessage,
  type PanelInitMessage
} from "../shared";

const createRequestId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const PANEL_RECONNECT_DELAY_MS = 600;
const PANEL_STATUS_DISCONNECT_DELAY_MS = 250;
const PANEL_CLEAR_MACHINES_DELAY_MS = 1200;
const getProtocolMismatchReason = (
  protocolVersion: JourneyDevtoolsProtocolVersion | undefined
): string | null => {
  if (protocolVersion === undefined || protocolVersion === JOURNEY_DEVTOOLS_PROTOCOL_VERSION) {
    return null;
  }

  return `This devtools panel uses protocol v${JOURNEY_DEVTOOLS_PROTOCOL_VERSION}, but the selected machine is still using protocol v${protocolVersion}. Update the inspected app and extension together.`;
};

export const App = () => {
  const [state, dispatch] = React.useReducer(panelReducer, undefined, createInitialPanelState);
  const [connectionWarning, setConnectionWarning] = React.useState<PanelWarning | null>(null);
  const [displayConnected, setDisplayConnected] = React.useState(false);
  const portRef = React.useRef<chrome.runtime.Port | null>(null);
  const statusDisconnectTimerRef = React.useRef<number | null>(null);
  const clearMachinesTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (statusDisconnectTimerRef.current !== null) {
      window.clearTimeout(statusDisconnectTimerRef.current);
      statusDisconnectTimerRef.current = null;
    }

    if (state.connected) {
      setDisplayConnected(true);
      return;
    }

    statusDisconnectTimerRef.current = window.setTimeout(() => {
      statusDisconnectTimerRef.current = null;
      setDisplayConnected(false);
    }, PANEL_STATUS_DISCONNECT_DELAY_MS);
  }, [state.connected]);

  React.useEffect(
    () => () => {
      if (statusDisconnectTimerRef.current !== null) {
        window.clearTimeout(statusDisconnectTimerRef.current);
        statusDisconnectTimerRef.current = null;
      }
      if (clearMachinesTimerRef.current !== null) {
        window.clearTimeout(clearMachinesTimerRef.current);
        clearMachinesTimerRef.current = null;
      }
    },
    []
  );

  React.useEffect(() => {
    let isDisposed = false;
    let reconnectTimer: number | null = null;
    let activePort: chrome.runtime.Port | null = null;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const connectPanelPort = () => {
      if (isDisposed) {
        return;
      }

      let port: chrome.runtime.Port;
      try {
        port = chrome.runtime.connect({ name: JOURNEY_DEVTOOLS_PANEL_PORT });
      } catch {
        dispatch({ type: "set-connected", connected: false });
        clearReconnectTimer();
        reconnectTimer = window.setTimeout(connectPanelPort, PANEL_RECONNECT_DELAY_MS);
        return;
      }

      activePort = port;
      portRef.current = port;

      const initMessage: PanelInitMessage = {
        type: "panel-init",
        tabId: chrome.devtools.inspectedWindow.tabId
      };
      port.postMessage(initMessage);

      const onMessage = (message: unknown) => {
        if (portRef.current !== port) {
          return;
        }

        if (!isBackgroundToPanelMessage(message)) {
          return;
        }

        const typedMessage: BackgroundToPanelMessage = message;
        if (typedMessage.type === "panel-connected") {
          if (clearMachinesTimerRef.current !== null) {
            window.clearTimeout(clearMachinesTimerRef.current);
            clearMachinesTimerRef.current = null;
          }
          dispatch({ type: "set-connected", connected: typedMessage.connected });
          if (typedMessage.connected) {
            setConnectionWarning(null);
          } else {
            clearMachinesTimerRef.current = window.setTimeout(() => {
              clearMachinesTimerRef.current = null;
              dispatch({ type: "clear-machines" });
            }, PANEL_CLEAR_MACHINES_DELAY_MS);
            setConnectionWarning(null);
          }
          return;
        }

        if (typedMessage.type === "panel-warning") {
          setConnectionWarning(typedMessage.warning);
          return;
        }

        dispatch({ type: "bridge-envelope", envelope: typedMessage.envelope });
      };

      const onDisconnect = () => {
        port.onMessage.removeListener(onMessage);
        port.onDisconnect.removeListener(onDisconnect);
        if (activePort === port) {
          activePort = null;
          portRef.current = null;
        }

        dispatch({ type: "set-connected", connected: false });
        if (clearMachinesTimerRef.current !== null) {
          window.clearTimeout(clearMachinesTimerRef.current);
          clearMachinesTimerRef.current = null;
        }
        setConnectionWarning(null);

        if (isDisposed) {
          return;
        }

        clearReconnectTimer();
        reconnectTimer = window.setTimeout(connectPanelPort, PANEL_RECONNECT_DELAY_MS);
      };

      port.onMessage.addListener(onMessage);
      port.onDisconnect.addListener(onDisconnect);
    };

    connectPanelPort();

    return () => {
      isDisposed = true;
      clearReconnectTimer();
      if (activePort) {
        activePort.disconnect();
      }
      activePort = null;
      portRef.current = null;
    };
  }, []);

  const sendCommand = React.useCallback(
    (machineId: string, command: JourneyDevtoolsCommand) => {
      const port = portRef.current;
      if (!port) {
        return;
      }

      const protocolVersion = state.machines[machineId]?.protocolVersion;
      if (getProtocolMismatchReason(protocolVersion) !== null) {
        return;
      }

      const requestId = createRequestId();
      dispatch({
        type: "queue-command",
        machineId,
        requestId,
        command,
        timestamp: Date.now()
      });

      const envelope = createCommandEnvelope(
        machineId,
        requestId,
        command,
        protocolVersion ?? JOURNEY_DEVTOOLS_PROTOCOL_VERSION
      );
      const message: PanelCommandMessage = {
        type: "panel-command",
        tabId: chrome.devtools.inspectedWindow.tabId,
        envelope
      };

      port.postMessage(message);
    },
    [state.machines]
  );

  const activeMachine = React.useMemo(() => selectActiveMachine(state), [state]);
  const displayedSnapshot = React.useMemo(
    () => selectDisplayedSnapshot(activeMachine),
    [activeMachine]
  );
  const selectedTimelineEntry = React.useMemo(
    () => selectSelectedTimelineEntry(activeMachine),
    [activeMachine]
  );
  const selectedDiff = React.useMemo(() => selectSelectedDiff(activeMachine), [activeMachine]);
  const isCommandChannelReady = state.connected && portRef.current !== null;
  const availableCommands = activeMachine?.meta.capabilities.commands ?? [];
  const protocolMismatchReason = getProtocolMismatchReason(activeMachine?.protocolVersion);
  const areCommandsDisabled = !isCommandChannelReady || protocolMismatchReason !== null;
  const commandDisabledReason = !isCommandChannelReady
    ? "Bridge is disconnected from the inspected tab."
    : protocolMismatchReason;

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Rxova Journey Devtools</h1>
        <p>Inspect machines, watch snapshots, and trigger events in real time.</p>
      </header>

      <SectionErrorBoundary section="Connection">
        <ConnectionStatus connected={displayConnected} warning={connectionWarning} />
      </SectionErrorBoundary>

      {activeMachine && protocolMismatchReason ? (
        <SectionErrorBoundary section="Compatibility">
          <section className="panel-card status-card">
            <h2>Compatibility</h2>
            <p className="status-warning">{protocolMismatchReason}</p>
            {activeMachine.protocolVersion === JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION ? (
              <p className="muted status-guidance">
                Legacy protocol v3 machines are read-only in this devtools build.
              </p>
            ) : null}
          </section>
        </SectionErrorBoundary>
      ) : null}

      <SectionErrorBoundary section="Machine Selector">
        <JourneyMachineSelector
          machineOrder={state.machineOrder}
          machines={state.machines}
          selectedMachineId={state.selectedMachineId}
          onSelect={(machineId) => dispatch({ type: "select-machine", machineId })}
        />
      </SectionErrorBoundary>

      {activeMachine ? (
        <>
          <SectionErrorBoundary section="Timeline">
            <TimelineInspector
              entries={activeMachine.timelineEntries}
              selectedIndex={activeMachine.selectedTimelineIndex}
              selectedEntry={selectedTimelineEntry}
              displayedSnapshot={displayedSnapshot}
              selectedDiff={selectedDiff}
              followLatest={activeMachine.followLatest}
              displayLimit={state.displayLimit}
              retentionCap={MAX_MACHINE_TIMELINE_ENTRIES}
              onSelectEntry={(index) =>
                dispatch({
                  type: "select-timeline-entry",
                  machineId: activeMachine.meta.machineId,
                  index
                })
              }
              onFollowLatestChange={(followLatest) =>
                dispatch({
                  type: "set-follow-latest",
                  machineId: activeMachine.meta.machineId,
                  followLatest
                })
              }
              onDisplayLimitChange={(limit) => dispatch({ type: "set-display-limit", limit })}
              onPrune={() =>
                dispatch({
                  type: "prune-timeline",
                  machineId: activeMachine.meta.machineId,
                  keep: state.displayLimit
                })
              }
            />
          </SectionErrorBoundary>

          <SectionErrorBoundary section="Controls">
            <CommandControls
              availableCommands={availableCommands}
              snapshotStatus={activeMachine.snapshot.status}
              disabled={areCommandsDisabled}
              disabledReason={commandDisabledReason}
              onCommand={(command) => sendCommand(activeMachine.meta.machineId, command)}
            />
          </SectionErrorBoundary>
        </>
      ) : (
        <section className="panel-card">
          <h2>No Active Machine</h2>
          <p className="muted">
            Call `attachJourneyDevtools(machine)` in the inspected application to stream Journey
            data.
          </p>
        </section>
      )}
    </main>
  );
};
