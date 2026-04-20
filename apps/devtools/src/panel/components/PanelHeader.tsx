import styles from "./appShell.module.css";

export const PanelHeader = () => (
  <header>
    <h1 className={styles.headerTitle}>Rxova Journey Devtools</h1>
    <p className={styles.headerDescription}>
      Inspect machines, watch snapshots, and trigger events in real time.
    </p>
  </header>
);
