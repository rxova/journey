import React from "react";
import { JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION } from "@rxova/journey-devtools-bridge";
import {
  MAX_MACHINE_TIMELINE_ENTRIES,
  selectActiveMachine,
  selectDisplayedSnapshot,
  selectSelectedDiff,
  selectSelectedTimelineEntry
} from "../store";
import {
  PanelActionsContext,
  PanelStateContext,
  useRequiredContext,
  type PanelActionsContextValue,
  type PanelStateContextValue
} from "./panel-context";
import { usePanelBridge } from "../hooks/usePanelBridge";
import { getProtocolMismatchReason } from "../utils/protocol";

export const PanelProvider = ({ children }: { children: React.ReactNode }) => {
  const {
    panelState,
    connectionWarning,
    displayConnected,
    isCommandChannelReady,
    invokeOperation,
    selectMachine,
    selectTimelineEntry,
    setFollowLatest,
    setDisplayLimit,
    pruneTimeline
  } = usePanelBridge();

  const activeMachine = React.useMemo(() => selectActiveMachine(panelState), [panelState]);
  const displayedSnapshot = React.useMemo(
    () => selectDisplayedSnapshot(activeMachine),
    [activeMachine]
  );
  const selectedTimelineEntry = React.useMemo(
    () => selectSelectedTimelineEntry(activeMachine),
    [activeMachine]
  );
  const selectedDiff = React.useMemo(() => selectSelectedDiff(activeMachine), [activeMachine]);
  const protocolMismatchReason = getProtocolMismatchReason(activeMachine?.protocolVersion);
  const areCommandsDisabled = !isCommandChannelReady || protocolMismatchReason !== null;
  const commandDisabledReason = !isCommandChannelReady
    ? "Bridge is disconnected from the inspected tab."
    : protocolMismatchReason;

  const stateValue = React.useMemo<PanelStateContextValue>(
    () => ({
      panelState,
      connectionWarning,
      displayConnected,
      activeMachine,
      displayedSnapshot,
      selectedTimelineEntry,
      selectedDiff,
      isCommandChannelReady,
      protocolMismatchReason,
      areCommandsDisabled,
      commandDisabledReason
    }),
    [
      activeMachine,
      areCommandsDisabled,
      commandDisabledReason,
      connectionWarning,
      displayConnected,
      displayedSnapshot,
      isCommandChannelReady,
      panelState,
      protocolMismatchReason,
      selectedDiff,
      selectedTimelineEntry
    ]
  );

  const actionsValue = React.useMemo<PanelActionsContextValue>(
    () => ({
      selectMachine,
      selectTimelineEntry,
      setFollowLatest,
      setDisplayLimit,
      pruneTimeline,
      invokeOperation
    }),
    [
      invokeOperation,
      pruneTimeline,
      selectMachine,
      selectTimelineEntry,
      setDisplayLimit,
      setFollowLatest
    ]
  );

  return (
    <PanelStateContext.Provider value={stateValue}>
      <PanelActionsContext.Provider value={actionsValue}>{children}</PanelActionsContext.Provider>
    </PanelStateContext.Provider>
  );
};

export const usePanelState = () => useRequiredContext(PanelStateContext, "usePanelState");

export const usePanelActions = () => useRequiredContext(PanelActionsContext, "usePanelActions");

export const usePanelConnection = () => {
  const { connectionWarning, displayConnected, isCommandChannelReady } = usePanelState();
  return { connectionWarning, displayConnected, isCommandChannelReady };
};

export const useActiveMachine = () => {
  const {
    activeMachine,
    displayedSnapshot,
    selectedTimelineEntry,
    selectedDiff,
    protocolMismatchReason,
    areCommandsDisabled,
    commandDisabledReason
  } = usePanelState();

  return {
    activeMachine,
    displayedSnapshot,
    selectedTimelineEntry,
    selectedDiff,
    protocolMismatchReason,
    areCommandsDisabled,
    commandDisabledReason
  };
};

export const useLegacyProtocolState = () => {
  const { activeMachine, protocolMismatchReason } = useActiveMachine();

  return {
    protocolMismatchReason,
    isLegacyProtocol: activeMachine?.protocolVersion === JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION
  };
};

export const usePanelTimelineRetention = () => MAX_MACHINE_TIMELINE_ENTRIES;
