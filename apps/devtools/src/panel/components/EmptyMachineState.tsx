import panelStyles from "./panelPrimitives.module.css";

export const EmptyMachineState = () => (
  <section className={panelStyles.card}>
    <h2 className={panelStyles.title}>No Active Machine</h2>
    <p className={panelStyles.muted}>
      Call `attachJourneyDevtools(machine)` in the inspected application to stream Journey data.
    </p>
  </section>
);
