import React from "react";
import type { JourneyDevtoolsOperationInvoke } from "@rxova/journey-devtools-bridge";
import { JOURNEY_DEVTOOLS_PROTOCOL_VERSION } from "@rxova/journey-devtools-bridge";
import { createInitialPanelState, panelReducer, type JourneyPanelState } from "../store";
import {
  JOURNEY_DEVTOOLS_PANEL_PORT,
  createInvokeEnvelope,
  isBackgroundToPanelMessage,
  type BackgroundToPanelMessage,
  type PanelCommandMessage,
  type PanelInitMessage,
  type PanelWarning
} from "../../shared";
import { getProtocolMismatchReason } from "../utils/protocol";

const PANEL_RECONNECT_DELAY_MS = 600;
const PANEL_STATUS_DISCONNECT_DELAY_MS = 250;
const PANEL_CLEAR_MACHINES_DELAY_MS = 1200;

const createRequestId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

type UsePanelBridgeResult = {
  panelState: JourneyPanelState;
  connectionWarning: PanelWarning | null;
  displayConnected: boolean;
  isCommandChannelReady: boolean;
  invokeOperation: (machineId: string, invocation: JourneyDevtoolsOperationInvoke) => void;
  selectMachine: (machineId: string) => void;
  selectTimelineEntry: (machineId: string, index: number) => void;
  setFollowLatest: (machineId: string, followLatest: boolean) => void;
  setDisplayLimit: (limit: number | null) => void;
  pruneTimeline: (machineId: string, keep: number | null) => void;
};

export const usePanelBridge = (): UsePanelBridgeResult => {
  const [panelState, dispatch] = React.useReducer(panelReducer, undefined, createInitialPanelState);
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

    if (panelState.connected) {
      setDisplayConnected(true);
      return;
    }

    statusDisconnectTimerRef.current = window.setTimeout(() => {
      statusDisconnectTimerRef.current = null;
      setDisplayConnected(false);
    }, PANEL_STATUS_DISCONNECT_DELAY_MS);
  }, [panelState.connected]);

  React.useEffect(
    () => () => {
      if (statusDisconnectTimerRef.current !== null) {
        window.clearTimeout(statusDisconnectTimerRef.current);
      }
      if (clearMachinesTimerRef.current !== null) {
        window.clearTimeout(clearMachinesTimerRef.current);
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
        if (portRef.current !== port || !isBackgroundToPanelMessage(message)) {
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

  const invokeOperation = React.useCallback(
    (machineId: string, invocation: JourneyDevtoolsOperationInvoke) => {
      const port = portRef.current;
      if (!port) {
        return;
      }

      const protocolVersion = panelState.machines[machineId]?.protocolVersion;
      if (getProtocolMismatchReason(protocolVersion) !== null) {
        return;
      }

      const requestId = createRequestId();
      dispatch({
        type: "queue-command",
        machineId,
        requestId,
        invocation,
        timestamp: Date.now()
      });

      const envelope = createInvokeEnvelope(
        machineId,
        requestId,
        invocation,
        protocolVersion ?? JOURNEY_DEVTOOLS_PROTOCOL_VERSION
      );
      const message: PanelCommandMessage = {
        type: "panel-command",
        tabId: chrome.devtools.inspectedWindow.tabId,
        envelope
      };

      port.postMessage(message);
    },
    [panelState.machines]
  );

  return {
    panelState,
    connectionWarning,
    displayConnected,
    isCommandChannelReady: panelState.connected && portRef.current !== null,
    invokeOperation,
    selectMachine: React.useCallback(
      (machineId: string) => dispatch({ type: "select-machine", machineId }),
      []
    ),
    selectTimelineEntry: React.useCallback(
      (machineId: string, index: number) =>
        dispatch({ type: "select-timeline-entry", machineId, index }),
      []
    ),
    setFollowLatest: React.useCallback(
      (machineId: string, followLatest: boolean) =>
        dispatch({ type: "set-follow-latest", machineId, followLatest }),
      []
    ),
    setDisplayLimit: React.useCallback((limit: number | null) => {
      dispatch({ type: "set-display-limit", limit });
    }, []),
    pruneTimeline: React.useCallback((machineId: string, keep: number | null) => {
      dispatch({ type: "prune-timeline", machineId, keep });
    }, [])
  };
};
