import { describe, expect, it } from "vitest";
import { analyzeStructure } from "@rxova/journey-core/diagnostics";
import type { JourneyStructure } from "@rxova/journey-core";

const graphStructure = (
  transitions: JourneyStructure["transitions"],
  stepIds: readonly string[] = ["a", "b", "done"]
): JourneyStructure => ({ kind: "graph", stepIds, initial: "a", transitions });

describe("analyzeStructure", () => {
  it("skips graph checks for non-graph structures", () => {
    const result = analyzeStructure({
      kind: "linear",
      stepIds: ["a", "b"],
      initial: "a",
      transitions: []
    });
    expect(result.issues).toEqual([]);
    expect(result.summary).toMatchObject({
      kind: "linear",
      graphChecksSkipped: true,
      reachableStepCount: 2
    });
  });

  it("finds unreachable steps and terminal facts on a plain pipeline", () => {
    const result = analyzeStructure(
      graphStructure(
        [
          { event: "GO", from: "a", to: "b", guarded: false },
          { event: "END", from: "b", to: "done", guarded: false }
        ],
        ["a", "b", "done", "orphan"]
      )
    );
    expect(result.issues.map((issue) => issue.code)).toEqual(["unreachable-step"]);
    expect(result.summary).toMatchObject({
      terminalStepIds: ["done", "orphan"],
      terminalPathExists: true,
      unreachableStepCount: 1
    });
  });

  it("flags shadowed transitions only after an unguarded candidate", () => {
    const shadowed = analyzeStructure(
      graphStructure([
        { event: "GO", from: "a", to: "b", guarded: false },
        { event: "GO", from: "a", to: "done", guarded: false }
      ])
    );
    expect(shadowed.summary.shadowedTransitionCount).toBe(1);

    const guardedFirst = analyzeStructure(
      graphStructure([
        { event: "GO", from: "a", to: "b", guarded: true },
        { event: "GO", from: "a", to: "done", guarded: false }
      ])
    );
    expect(guardedFirst.summary.shadowedTransitionCount).toBe(0);
  });

  it("detects cycles and missing terminal paths", () => {
    const result = analyzeStructure(
      graphStructure(
        [
          { event: "GO", from: "a", to: "b", guarded: false },
          { event: "BACK", from: "b", to: "a", guarded: false }
        ],
        ["a", "b"]
      )
    );
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain("cycle-detected");
    expect(codes).toContain("no-terminal-path");
    expect(result.summary.cycleCount).toBe(1);
    expect(result.summary.terminalPathExists).toBe(false);
  });
});
