import { describe, expect, it } from "vitest";
import { analyzeStructure } from "@rxova/journey-core";

// These used to hand-build `JourneyStructure` objects and call the analyzer
// directly. The analyzer is private now — `analyzeStructure` takes the
// definition and derives the structure itself — so each case is expressed as
// the definition that produces it, which is also how a caller would hit it.
describe("analyzeStructure", () => {
  it("finds unreachable steps and terminal facts on a plain pipeline", () => {
    const result = analyzeStructure({
      steps: {
        a: { on: { GO: "b" } },
        b: { on: { END: "done" } },
        done: {},
        orphan: {}
      },
      initial: "a"
    });
    expect(result.issues.map((issue) => issue.code)).toEqual(["unreachable-step"]);
    expect(result.summary).toMatchObject({
      terminalStepIds: ["done", "orphan"],
      terminalPathExists: true,
      unreachableStepCount: 1
    });
  });

  it("flags shadowed transitions only after an unguarded candidate", () => {
    const shadowed = analyzeStructure({
      steps: { a: { on: { GO: [{ to: "b" }, { to: "done" }] } }, b: {}, done: {} },
      initial: "a"
    });
    expect(shadowed.summary.shadowedTransitionCount).toBe(1);

    const guardedFirst = analyzeStructure({
      steps: {
        a: { on: { GO: [{ to: "b", when: () => false }, { to: "done" }] } },
        b: {},
        done: {}
      },
      initial: "a"
    });
    expect(guardedFirst.summary.shadowedTransitionCount).toBe(0);
  });

  it("detects cycles and missing terminal paths", () => {
    const result = analyzeStructure({
      steps: { a: { on: { GO: "b" } }, b: { on: { BACK: "a" } } },
      initial: "a"
    });
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain("cycle-detected");
    expect(codes).toContain("no-terminal-path");
    expect(result.summary.cycleCount).toBe(1);
    expect(result.summary.terminalPathExists).toBe(false);
  });

  it("reports the same cycle only once when duplicate edges discover it twice", () => {
    const result = analyzeStructure({
      steps: { a: { on: { GO: "b" } }, b: { on: { BACK: "a", BACK_AGAIN: "a" } } },
      initial: "a"
    });

    expect(result.issues.filter((issue) => issue.code === "cycle-detected")).toHaveLength(1);
  });
});
