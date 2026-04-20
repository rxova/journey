import { ConnectionStatus } from "./ConnectionStatus";
import { JourneyMachineSelector } from "./JourneyMachineSelector";
import { SectionErrorBoundary } from "./SectionErrorBoundary";
import { PanelHeader } from "./PanelHeader";
import { CompatibilityNotice } from "./CompatibilityNotice";
import { EmptyMachineState } from "./EmptyMachineState";
import { ActiveMachinePanel } from "./ActiveMachinePanel";
import {
  useActiveMachine,
  usePanelActions,
  usePanelConnection,
  usePanelState
} from "../context/PanelProvider";
import styles from "./appShell.module.css";

export const AppShell = () => {
  const { connectionWarning, displayConnected } = usePanelConnection();
  const { panelState } = usePanelState();
  const { activeMachine } = useActiveMachine();
  const { selectMachine } = usePanelActions();

  return (
    <main className={styles.shell}>
      <PanelHeader />

      <SectionErrorBoundary section="Connection">
        <ConnectionStatus connected={displayConnected} warning={connectionWarning} />
      </SectionErrorBoundary>

      <SectionErrorBoundary section="Compatibility">
        <CompatibilityNotice />
      </SectionErrorBoundary>

      <SectionErrorBoundary section="Machine Selector">
        <JourneyMachineSelector
          machineOrder={panelState.machineOrder}
          machines={panelState.machines}
          selectedMachineId={panelState.selectedMachineId}
          onSelect={selectMachine}
        />
      </SectionErrorBoundary>

      {activeMachine ? <ActiveMachinePanel /> : <EmptyMachineState />}
    </main>
  );
};
