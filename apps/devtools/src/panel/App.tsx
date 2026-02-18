import React from "react";

import type { JourneyDevtoolsCommand } from "@rxova/journey-devtools-bridge";
import { CommandControls } from "./components/CommandControls";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { EventLog } from "./components/EventLog";
import { MachineSelector } from "./components/MachineSelector";
import { SnapshotTabs } from "./components/SnapshotTabs";
import {
  MAX_MACHINE_LOGS,
  createInitialPanelState,
  panelReducer,
  selectActiveMachine,
  selectVisibleLogs
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

export const App = () => {
  const [state, dispatch] = React.useReducer(panelReducer, undefined, createInitialPanelState);
  const [connectionWarning, setConnectionWarning] = React.useState<PanelWarning | null>(null);
  const portRef = React.useRef<chrome.runtime.Port | null>(null);

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
        if (!isBackgroundToPanelMessage(message)) {
          return;
        }

        const typedMessage: BackgroundToPanelMessage = message;
        if (typedMessage.type === "panel-connected") {
          dispatch({ type: "set-connected", connected: typedMessage.connected });
          if (typedMessage.connected) {
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

  const sendCommand = React.useCallback((machineId: string, command: JourneyDevtoolsCommand) => {
    const port = portRef.current;
    if (!port) {
      return;
    }

    const envelope = createCommandEnvelope(machineId, createRequestId(), command);
    const message: PanelCommandMessage = {
      type: "panel-command",
      tabId: chrome.devtools.inspectedWindow.tabId,
      envelope
    };

    port.postMessage(message);
  }, []);

  const activeMachine = React.useMemo(() => selectActiveMachine(state), [state]);
  const areMachineCommandsEnabled = activeMachine?.meta.commandsEnabled !== false;
  const visibleLogs = React.useMemo(
    () => selectVisibleLogs(activeMachine?.logs ?? [], state.displayLimit),
    [activeMachine?.logs, state.displayLimit]
  );

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Rxova Journey Devtools</h1>
        <p>Inspect machines, watch snapshots, and trigger events in real time.</p>
      </header>

      <ConnectionStatus connected={state.connected} warning={connectionWarning} />

      <MachineSelector
        machineOrder={state.machineOrder}
        machines={state.machines}
        selectedMachineId={state.selectedMachineId}
        onSelect={(machineId) => dispatch({ type: "select-machine", machineId })}
      />

      {activeMachine ? (
        <>
          <SnapshotTabs snapshot={activeMachine.snapshot} />

          <CommandControls
            disabled={!state.connected || !areMachineCommandsEnabled}
            disabledReason={
              !state.connected
                ? "Bridge is disconnected from the inspected tab."
                : !areMachineCommandsEnabled
                  ? "Commands are disabled for this machine."
                  : null
            }
            onCommand={(command) => sendCommand(activeMachine.meta.machineId, command)}
          />

          <EventLog
            logs={visibleLogs}
            totalCount={activeMachine.logs.length}
            retentionCap={MAX_MACHINE_LOGS}
            displayLimit={state.displayLimit}
            onDisplayLimitChange={(limit) => dispatch({ type: "set-display-limit", limit })}
            onPrune={() =>
              dispatch({
                type: "prune-logs",
                machineId: activeMachine.meta.machineId,
                keep: state.displayLimit
              })
            }
          />
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
