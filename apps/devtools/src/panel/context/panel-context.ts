import React from "react";
import type {
  JourneyDevtoolsOperationInvoke,
  JourneyDevtoolsSerializableSnapshot
} from "@rxova/journey-devtools-bridge";
import type { JourneyPanelStructuredDiff } from "../diff";
import type {
  JourneyPanelMachineState,
  JourneyPanelState,
  JourneyPanelTimelineEntry
} from "../store";
import type { PanelWarning } from "../../shared";

export type PanelStateContextValue = {
  panelState: JourneyPanelState;
  connectionWarning: PanelWarning | null;
  displayConnected: boolean;
  activeMachine: JourneyPanelMachineState | null;
  displayedSnapshot: JourneyDevtoolsSerializableSnapshot | null;
  selectedTimelineEntry: JourneyPanelTimelineEntry | null;
  selectedDiff: JourneyPanelStructuredDiff;
  isCommandChannelReady: boolean;
  protocolMismatchReason: string | null;
  areCommandsDisabled: boolean;
  commandDisabledReason: string | null;
};

export type PanelActionsContextValue = {
  selectMachine: (machineId: string) => void;
  selectTimelineEntry: (machineId: string, index: number) => void;
  setFollowLatest: (machineId: string, followLatest: boolean) => void;
  setDisplayLimit: (limit: number | null) => void;
  pruneTimeline: (machineId: string, keep: number | null) => void;
  invokeOperation: (machineId: string, invocation: JourneyDevtoolsOperationInvoke) => void;
};

export const PanelStateContext = React.createContext<PanelStateContextValue | null>(null);
export const PanelActionsContext = React.createContext<PanelActionsContextValue | null>(null);

export const useRequiredContext = <T>(context: React.Context<T | null>, label: string): T => {
  const value = React.useContext(context);
  if (!value) {
    throw new Error(`${label} must be used within a PanelProvider.`);
  }

  return value;
};
