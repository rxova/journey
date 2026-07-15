import type { JourneyDevtoolsSerializableSnapshot } from "@rxova/journey-devtools-bridge";

type LegacySnapshot = {
  currentStepId?: unknown;
};

/** Reads v7 snapshots while keeping older, read-only protocol views usable. */
export const getSnapshotCurrentStepId = (
  snapshot: JourneyDevtoolsSerializableSnapshot
): string | null => {
  if (snapshot.currentStep) {
    return snapshot.currentStep.id;
  }

  const legacyStepId = (snapshot as unknown as LegacySnapshot).currentStepId;
  return typeof legacyStepId === "string" ? legacyStepId : null;
};
