export type ReplayEntryKind = "status" | "transition" | "context" | "navigationBlocked" | "error";

export type ReplayEntry = {
  readonly at: number;
  readonly kind: ReplayEntryKind;
  readonly data: unknown;
  /** Present when `captureSnapshots` is enabled. */
  readonly snapshot?: unknown;
};

export type ReplaySession = {
  readonly startedAt: number;
  readonly entries: readonly ReplayEntry[];
};

export type ReplayPluginOptions = {
  /** Ring-buffer capacity. Defaults to 500; clamped to >= 1. */
  maxEntries?: number;
  /** Attach a serialized snapshot to each entry. Defaults to `true`. */
  captureSnapshots?: boolean;
  /** Injectable clock, mainly for tests. */
  now?: () => number;
};

export type ReplayExportOptions = { pretty?: boolean };

export type ReplayApi = {
  getReplaySession(): ReplaySession;
  clearReplaySession(): void;
  exportReplaySession(options?: ReplayExportOptions): string;
};
