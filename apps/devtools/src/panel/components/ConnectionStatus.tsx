import React from "react";
import type { PanelWarning } from "../../shared";

type ConnectionStatusProps = {
  connected: boolean;
  warning: PanelWarning | null;
};

const getWarningGuidance = (warning: PanelWarning): string | null => {
  if (warning.code === "injection-failed") {
    return warning.recoverable === false
      ? "Injection failed in this tab context and may not be recoverable."
      : "Reload the inspected tab and keep the Journey panel open to retry injection.";
  }

  if (warning.code === "injection-missing-entry") {
    return "Verify the extension build output includes the content bridge entry.";
  }

  if (warning.code === "injection-unavailable") {
    return "This browser context does not support dynamic script injection for the inspected tab.";
  }

  return null;
};

export const ConnectionStatus = ({ connected, warning }: ConnectionStatusProps) => (
  <section className="panel-card status-card">
    <h2>Connection</h2>
    <p className={connected ? "status-ok" : "status-off"}>
      {connected ? "Connected to inspected tab" : "Waiting for bridge messages"}
    </p>
    {warning ? <p className="status-warning">{warning.message}</p> : null}
    {warning && getWarningGuidance(warning) ? (
      <p className="muted status-guidance">{getWarningGuidance(warning)}</p>
    ) : null}
  </section>
);
