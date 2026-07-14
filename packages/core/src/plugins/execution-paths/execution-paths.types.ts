export type ExecutionPathsApi = {
  /** The committed step sequence of the current run. */
  getCurrentPath(): readonly string[];
  /** Paths of finished runs (a run ends on complete/terminate/restart). */
  getCompletedPaths(): readonly (readonly string[])[];
};

export type ExecutionPathsSnapshot = {
  readonly currentPath: readonly string[];
  readonly completedPaths: readonly (readonly string[])[];
};
