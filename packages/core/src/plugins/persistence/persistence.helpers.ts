import type { JourneyPersistedState } from "./persistence.types";
import type { JourneySnapshot } from "../../core/types";

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
