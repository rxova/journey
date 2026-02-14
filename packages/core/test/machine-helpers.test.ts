import { describe, expect, it } from "vitest";

import { JOURNEY_STATUS } from "@rxova/journey-core";
import {
  buildInitialAsyncState,
  buildSnapshot,
  resolveHistoryTarget
} from "../src/machine-helpers";

type StepId = "a" | "b" | "c";

describe("machine helpers", () => {
  it("returns the most recent valid step from history", () => {
    const steps: Record<StepId, unknown> = {
      a: {},
      b: {},
      c: {}
    };
    const snapshot = buildSnapshot(
      "c",
      { ok: true },
      ["a", "b"],
      JOURNEY_STATUS.RUNNING,
      buildInitialAsyncState(steps)
    );

    const result = resolveHistoryTarget(snapshot, steps);

    expect(result).toEqual({ target: "b", history: ["a"] });
  });

  it("falls back to current when history has no valid entries", () => {
    const steps: Record<StepId, unknown> = {
      a: {},
      b: {},
      c: {}
    };
    const snapshot = buildSnapshot(
      "b",
      { ok: true },
      ["missing" as StepId],
      JOURNEY_STATUS.RUNNING,
      buildInitialAsyncState(steps)
    );

    const result = resolveHistoryTarget(snapshot, steps);

    expect(result).toEqual({ target: "b", history: ["missing" as StepId] });
  });
});
