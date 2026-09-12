export type ExecutionPathsPluginOptions = {
  /**
   * How many finished runs to retain, newest kept. Defaults to 50. Older paths
   * are dropped once the bound is reached — this history is diagnostic, and a
   * long-lived machine that completes and restarts repeatedly would otherwise
   * grow it for the lifetime of the process.
   */
  maxPaths?: number;
};

export type ExecutionPathsApi = {
  /** The committed step sequence of the current run. */
  getCurrentPath(): readonly string[];
  /** Paths of finished runs (a run ends on complete/terminate/restart). */
  getCompletedPaths(): readonly (readonly string[])[];
  /** Drops every retained completed path. The current run is untouched. */
  clearCompletedPaths(): void;
};

export type ExecutionPathsSnapshot = {
  readonly currentPath: readonly string[];
  readonly completedPaths: readonly (readonly string[])[];
};
