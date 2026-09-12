import React from "react";

import type { JourneyPanelMachineState } from "../store";
import panelStyles from "./panelPrimitives.module.css";
import styles from "./journeyMachineSelector.module.css";

type JourneyMachineSelectorProps = {
  machineOrder: readonly string[];
  machines: Record<string, JourneyPanelMachineState>;
  selectedMachineId: string | null;
  onSelect: (machineId: string) => void;
};

export const JourneyMachineSelector = React.memo(
  ({ machineOrder, machines, selectedMachineId, onSelect }: JourneyMachineSelectorProps) => {
    return (
      <section className={panelStyles.card}>
        <h2 className={panelStyles.title}>Journey Machines</h2>
        {machineOrder.length === 0 ? (
          <p className={panelStyles.muted}>No journey machines registered yet.</p>
        ) : (
          <select
            value={selectedMachineId ?? ""}
            onChange={(event) => onSelect(event.target.value)}
            className={styles.select}
          >
            {machineOrder.map((machineId) => {
              const journeyMachine = machines[machineId];
              if (!journeyMachine) {
                return null;
              }
              const suffix = journeyMachine.meta.appName ? ` (${journeyMachine.meta.appName})` : "";
              return (
                <option key={machineId} value={machineId}>
                  {`${journeyMachine.meta.label}${suffix}`}
                </option>
              );
            })}
          </select>
        )}
      </section>
    );
  }
);
