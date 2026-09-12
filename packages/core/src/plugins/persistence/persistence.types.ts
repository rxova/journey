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

/** The observations that trigger a save. */
export type PersistenceReason = "context" | "transition" | "status";

export type PersistencePluginOptions = {
  storage: JourneyStorage;
  key: string;
  /**
   * Wait this many milliseconds after an observation before writing, collapsing
   * a burst of changes into one write. Omitted or `0` writes immediately.
   *
   * This subsumes what used to be a separate autosave plugin. It was the same
   * plugin with a timer: the same serializer, the same storage adapter, the same
   * key — so having two of them meant choosing between "persist" and "persist,
   * but later", which is a parameter, not a plugin.
   */
  debounceMs?: number;
  /** Which observations schedule a save. Defaults to all of them. */
  saveOn?: readonly PersistenceReason[];
  /** Remove the persisted entry when the journey terminates. Defaults to `false`. */
  clearOnTerminate?: boolean;
  /** Injectable clock, mainly for tests. */
  now?: () => number;
};

export type PersistenceState = {
  /**
   * `"pending"` only ever appears when `debounceMs` is set — an immediate write
   * has no window in which to be pending.
   */
  readonly status: "idle" | "pending" | "saving" | "saved" | "error";
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
  /** Last write status, confirmed write time, and last write failure. */
  getPersistenceState(): PersistenceState;
  /** Re-reads and parses storage; `null` when absent, malformed, or foreign. */
  readPersisted(): JourneyPersistedState | null;
  /** Cancels any pending debounced save and removes the persisted entry. */
  clearPersisted(): void;
  /** Cancels the debounce and writes now. Resolves once the write settles. */
  flushPersisted(): Promise<void>;
};
