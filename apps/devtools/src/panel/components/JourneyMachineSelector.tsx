import React from "react";

import type { JourneyPanelMachineState } from "../store";

type JourneyMachineSelectorProps = {
  machineOrder: readonly string[];
  machines: Record<string, JourneyPanelMachineState>;
  selectedMachineId: string | null;
  onSelect: (machineId: string) => void;
};

export const JourneyMachineSelector = React.memo(
  ({ machineOrder, machines, selectedMachineId, onSelect }: JourneyMachineSelectorProps) => {
    return (
      <section className="panel-card">
        <h2>Journey Machines</h2>
        {machineOrder.length === 0 ? (
          <p className="muted">No journey machines registered yet.</p>
        ) : (
          <select
            value={selectedMachineId ?? ""}
            onChange={(event) => onSelect(event.target.value)}
            className="machine-select"
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
