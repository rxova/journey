import type { AutosaveReason } from "./autosave.types";

export const DEFAULT_SAVE_REASONS: readonly AutosaveReason[] = ["context", "transition", "status"];

export function normalizeDebounceMs(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 300;
  return Math.max(0, Math.trunc(value));
}
