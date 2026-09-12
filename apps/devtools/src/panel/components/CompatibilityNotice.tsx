import { JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION } from "@rxova/journey-devtools-bridge";
import { useActiveMachine, useLegacyProtocolState } from "../context/PanelProvider";
import panelStyles from "./panelPrimitives.module.css";

export const CompatibilityNotice = () => {
  const { activeMachine } = useActiveMachine();
  const { protocolMismatchReason, isLegacyProtocol } = useLegacyProtocolState();

  if (!activeMachine || !protocolMismatchReason) {
    return null;
  }

  return (
    <section className={panelStyles.card}>
      <h2 className={panelStyles.title}>Compatibility</h2>
      <p className={panelStyles.statusWarning}>{protocolMismatchReason}</p>
      {isLegacyProtocol ? (
        <p className={`${panelStyles.muted} ${panelStyles.statusGuidance}`}>
          {/* Interpolated, not spelled out: this line read "v3" while the
              constant was 5, having been missed by two protocol bumps. */}
          Legacy protocol v{JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION} machines are read-only in this
          devtools build.
        </p>
      ) : null}
    </section>
  );
};
