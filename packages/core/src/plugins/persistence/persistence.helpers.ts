import type { JourneyPersistedState, JourneyStorage } from "./persistence.types";
import type { JourneyPersistOption, JourneySnapshot } from "../../core/types";

export function buildPersistedState(snapshot: JourneySnapshot, now: number): JourneyPersistedState {
  return {
    status: snapshot.status,
    context: snapshot.context,
    timeline: snapshot.history.timeline,
    currentIndex: snapshot.history.currentIndex,
    savedAt: now
  };
}

/** Parses a stored value; malformed or foreign payloads yield `null`. */
export function parsePersistedState(raw: string | null): JourneyPersistedState | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.status !== "string" ||
    !Array.isArray(candidate.timeline) ||
    typeof candidate.currentIndex !== "number" ||
    typeof candidate.savedAt !== "number"
  ) {
    return null;
  }
  return candidate as unknown as JourneyPersistedState;
}

/**
 * Resolves the `persist` option's storage; throws when none is available.
 *
 * Reading `globalThis.localStorage` can itself throw — a third-party iframe
 * with storage blocked, or Safari's Lockdown Mode — rather than returning
 * undefined. Unguarded, that surfaced as a raw `SecurityError` out of
 * `createLinearJourney`, which reads as a library crash rather than an
 * environment that cannot persist. The failure stays loud (silently disabling
 * persistence loses data with no signal) but is now a `journey:` error naming
 * the fix, with the original kept as `cause`.
 */
export function resolvePersistStorage(option: JourneyPersistOption): JourneyStorage {
  if (option.storage) return option.storage;

  let ambient: JourneyStorage | undefined;
  try {
    ambient = globalThis.localStorage as JourneyStorage | undefined;
  } catch (error) {
    const blocked = new Error(
      "journey: localStorage access was blocked by the environment; pass persist.storage explicitly"
    );
    // Assigned rather than passed to the constructor: `cause` is ES2022 and the
    // compilation target is ES2020, so the two-argument form does not typecheck.
    (blocked as { cause?: unknown }).cause = error;
    throw blocked;
  }

  if (!ambient) {
    throw new Error("journey: persist.storage is required when localStorage is unavailable");
  }
  return ambient;
}

/**
 * Reads a persisted record that can seed this machine, or `null`. Restore is
 * best-effort by design: terminal-status records, records whose timeline
 * mentions a step the current definition no longer declares (definition
 * drift), and malformed/foreign payloads are all ignored rather than thrown.
 */
export function readRestorableState(
  option: JourneyPersistOption,
  isDeclaredStep: (id: string) => boolean
): JourneyPersistedState | null {
  let raw: string | null;
  try {
    raw = resolvePersistStorage(option).getItem(option.key);
  } catch {
    return null;
  }
  const record = parsePersistedState(raw);
  if (!record) return null;
  if (record.status !== "running" && record.status !== "paused") return null;
  if (!Number.isInteger(record.currentIndex)) return null;
  if (record.currentIndex < 0 || record.currentIndex >= record.timeline.length) return null;
  for (const id of record.timeline) {
    if (typeof id !== "string" || !isDeclaredStep(id)) return null;
  }
  return record;
}
