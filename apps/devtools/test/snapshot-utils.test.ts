import { describe, expect, it } from "vitest";
import type { JourneyDevtoolsSerializableSnapshot } from "@rxova/journey-devtools-bridge";
import { INITIAL_SNAPSHOT } from "../src/panel/store";
import { getSnapshotCurrentStepId } from "../src/panel/utils/snapshot";

describe("getSnapshotCurrentStepId", () => {
  it("reads the current v7 step", () => {
    const snapshot: JourneyDevtoolsSerializableSnapshot = {
      ...INITIAL_SNAPSHOT,
      currentStep: {
        id: "review",
        metadata: null,
        isFirstTimeVisit: true,
        async: { isLoading: false, isSuccess: true, isError: false, error: null },
        isTerminal: false
      }
    };

    expect(getSnapshotCurrentStepId(snapshot)).toBe("review");
  });

  it("falls back to legacy snapshot ids and handles an idle v7 snapshot", () => {
    const legacySnapshot = { currentStepId: "legacy" } as JourneyDevtoolsSerializableSnapshot;

    expect(getSnapshotCurrentStepId(legacySnapshot)).toBe("legacy");
    expect(getSnapshotCurrentStepId(INITIAL_SNAPSHOT)).toBeNull();
  });
});
