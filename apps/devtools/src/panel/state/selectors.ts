import {
  EMPTY_STRUCTURED_DIFF,
  computeStructuredDiff,
  type JourneyPanelStructuredDiff
} from "../diff";
import type {
  JourneyPanelMachineState,
  JourneyPanelState,
  JourneyPanelTimelineEntry
} from "./types";
import { resolveSnapshotAtIndex } from "./timeline";

export const selectActiveMachine = (state: JourneyPanelState): JourneyPanelMachineState | null =>
  state.selectedMachineId ? (state.machines[state.selectedMachineId] ?? null) : null;

export const selectVisibleTimelineEntries = (
  entries: readonly JourneyPanelTimelineEntry[],
  limit: number | null
): JourneyPanelTimelineEntry[] => {
  if (limit === null) {
    return [...entries];
  }

  const keep = Math.max(0, limit);
  return entries.slice(Math.max(0, entries.length - keep));
};

export const selectSelectedTimelineEntry = (
  machine: JourneyPanelMachineState | null
): JourneyPanelTimelineEntry | null => {
  if (!machine || machine.timelineEntries.length === 0) {
    return null;
  }

  const safeIndex = Math.max(
    0,
    Math.min(machine.selectedTimelineIndex, machine.timelineEntries.length - 1)
  );
  return machine.timelineEntries[safeIndex] ?? null;
};

export const selectDisplayedSnapshot = (machine: JourneyPanelMachineState | null) => {
  if (!machine) {
    return null;
  }

  if (machine.followLatest || machine.timelineEntries.length === 0) {
    return machine.snapshot;
  }

  const safeIndex = Math.max(
    0,
    Math.min(machine.selectedTimelineIndex, machine.timelineEntries.length - 1)
  );
  return resolveSnapshotAtIndex(machine.timelineEntries, safeIndex) ?? machine.snapshot;
};

export const selectSelectedDiff = (
  machine: JourneyPanelMachineState | null
): JourneyPanelStructuredDiff => {
  if (!machine || machine.timelineEntries.length === 0) {
    return EMPTY_STRUCTURED_DIFF;
  }

  const safeIndex = Math.max(
    0,
    Math.min(machine.selectedTimelineIndex, machine.timelineEntries.length - 1)
  );
  const currentEntry = machine.timelineEntries[safeIndex] ?? null;
  const currentSnapshot = resolveSnapshotAtIndex(machine.timelineEntries, safeIndex);
  const previousSnapshot =
    safeIndex > 0 ? resolveSnapshotAtIndex(machine.timelineEntries, safeIndex - 1) : null;

  if (!currentSnapshot || !previousSnapshot) {
    return EMPTY_STRUCTURED_DIFF;
  }

  const immediateDiff = computeStructuredDiff(previousSnapshot, currentSnapshot);
  const immediateDiffIsEmpty =
    Object.keys(immediateDiff.added).length === 0 &&
    Object.keys(immediateDiff.removed).length === 0 &&
    Object.keys(immediateDiff.changed).length === 0;

  if (
    immediateDiffIsEmpty &&
    currentEntry?.envelopeKind === "operationResult" &&
    safeIndex > 1 &&
    machine.timelineEntries[safeIndex - 1]?.envelopeKind === "snapshot"
  ) {
    const snapshotBeforeImmediate = resolveSnapshotAtIndex(machine.timelineEntries, safeIndex - 2);
    if (snapshotBeforeImmediate) {
      return computeStructuredDiff(snapshotBeforeImmediate, currentSnapshot);
    }
  }

  return immediateDiff;
};
