import { describe, expect, it } from "vitest";
import { INITIAL_SNAPSHOT } from "../src/panel/store";
import { getSnapshotCurrentStepId } from "../src/panel/utils/snapshot";
import { createGraphSnapshot } from "./fixtures";

describe("getSnapshotCurrentStepId", () => {
  it("reads the current v7 step", () => {
    const snapshot = createGraphSnapshot("review");

    expect(getSnapshotCurrentStepId(snapshot)).toBe("review");
  });

  it("falls back to legacy snapshot ids and handles an idle v7 snapshot", () => {
    const legacySnapshot = { currentStepId: "legacy" } as unknown as Parameters<
      typeof getSnapshotCurrentStepId
    >[0];

    expect(getSnapshotCurrentStepId(legacySnapshot)).toBe("legacy");
    expect(getSnapshotCurrentStepId(INITIAL_SNAPSHOT)).toBeNull();
  });
});
