import type { JourneyStatus } from "../../core/types";

/** localStorage-compatible adapter; `setItem` may be async. */
export type JourneyStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void;
};

/** The serializable slice of machine state persisted to storage. */
export type JourneyPersistedState = {
  readonly status: JourneyStatus;
  readonly context: unknown;
  readonly timeline: readonly string[];
  readonly currentIndex: number;
  readonly savedAt: number;
};

export type PersistencePluginOptions = {
  storage: JourneyStorage;
  key: string;
  /** Remove the persisted entry when the journey terminates. Defaults to `false`. */
  clearOnTerminate?: boolean;
  /** Injectable clock, mainly for tests. */
  now?: () => number;
};

export type PersistenceState = {
  /** When the last **confirmed** write landed, not when one was attempted. */
  readonly lastSavedAt: number | null;
  /** The most recent write failure, cleared by the next successful write. */
  readonly error: unknown | null;
};

export type PersistenceApi = {
  /**
   * The last state this run confirmed to storage (not re-read from it), or
   * `null` if nothing has been written yet.
   */
  inspectPersistedState(): JourneyPersistedState | null;
  /** Last confirmed write time and last write failure. */
  getPersistenceState(): PersistenceState;
  /** Re-reads and parses storage; `null` when absent, malformed, or foreign. */
  readPersisted(): JourneyPersistedState | null;
  clearPersisted(): void;
};
