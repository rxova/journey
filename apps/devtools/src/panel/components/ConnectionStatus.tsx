import React from "react";
import type { PanelWarning } from "../../shared";
import panelStyles from "./panelPrimitives.module.css";

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
  <section className={panelStyles.card}>
    <h2 className={panelStyles.title}>Connection</h2>
    <p className={connected ? panelStyles.statusOk : panelStyles.statusOff}>
      {connected ? "Connected to inspected tab" : "Waiting for bridge messages"}
    </p>
    {warning ? <p className={panelStyles.statusWarning}>{warning.message}</p> : null}
    {warning && getWarningGuidance(warning) ? (
      <p className={`${panelStyles.muted} ${panelStyles.statusGuidance}`}>
        {getWarningGuidance(warning)}
      </p>
    ) : null}
  </section>
);
