import type { JourneyPersistedState, JourneyStorage } from "../persistence/persistence.types";

export type AutosaveReason = "context" | "transition" | "status";

export type AutosavePluginOptions = {
  storage: JourneyStorage;
  key: string;
  /** Debounce window in milliseconds. Defaults to 300; clamped to >= 0. */
  debounceMs?: number;
  /** Which observations schedule a save. Defaults to all of them. */
  saveOn?: readonly AutosaveReason[];
  /** Injectable clock, mainly for tests. */
  now?: () => number;
};

export type AutosaveState = {
  readonly status: "idle" | "pending" | "saving" | "saved" | "error";
  readonly lastSavedAt: number | null;
  readonly error: unknown | null;
};

export type AutosaveApi = {
  getAutosaveState(): AutosaveState;
  /** Cancels the debounce and saves immediately. */
  flushAutosave(): Promise<void>;
  /** Cancels any pending save and removes the persisted entry. */
  clearAutosave(): void;
  readPersisted(): JourneyPersistedState | null;
};
