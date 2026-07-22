import type { JourneyStatus } from "../../core/types.js";

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

export type PersistenceApi = {
  /** The last state written by this run (not re-read from storage). */
  inspectPersistedState(): JourneyPersistedState | null;
  /** Re-reads and parses storage; `null` when absent or malformed. */
  readPersisted(): JourneyPersistedState | null;
  clearPersisted(): void;
};
