import React from "react";

import type { JourneyPanelMachineState } from "../store";

type MachineSelectorProps = {
  machineOrder: readonly string[];
  machines: Record<string, JourneyPanelMachineState>;
  selectedMachineId: string | null;
  onSelect: (machineId: string) => void;
};

export const MachineSelector = React.memo(
  ({ machineOrder, machines, selectedMachineId, onSelect }: MachineSelectorProps) => {
    return (
      <section className="panel-card">
        <h2>Machines</h2>
        {machineOrder.length === 0 ? (
          <p className="muted">No machines registered yet.</p>
        ) : (
          <select
            value={selectedMachineId ?? ""}
            onChange={(event) => onSelect(event.target.value)}
            className="machine-select"
          >
            {machineOrder.map((machineId) => {
              const machine = machines[machineId];
              if (!machine) {
                return null;
              }
              const suffix = machine.meta.appName ? ` (${machine.meta.appName})` : "";
              return (
                <option key={machineId} value={machineId}>
                  {`${machine.meta.label}${suffix}`}
                </option>
              );
            })}
          </select>
        )}
      </section>
    );
  }
);
