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
          Legacy protocol v3 machines are read-only in this devtools build.
        </p>
      ) : null}
    </section>
  );
};
