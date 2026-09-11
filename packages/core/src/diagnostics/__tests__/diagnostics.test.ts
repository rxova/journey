import { describe, expect, it } from "vitest";
import { analyzeStructure } from "@rxova/journey-core";

describe("analyzeStructure", () => {
  it("reports unreachable steps, shadowed transitions, cycles, and terminal facts", () => {
    const result = analyzeStructure({
      steps: {
        a: { on: { GO: [{ to: "b" }, { to: "done" }] } },
        b: { on: { BACK: "a", FINISH: "done" } },
        orphan: {},
        done: {}
      },
      initial: "a"
    });

    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain("unreachable-step");
    expect(codes).toContain("shadowed-transition");
    expect(codes).toContain("cycle-detected");
    expect(codes).not.toContain("no-terminal-path");

    expect(result.summary).toMatchObject({
      stepCount: 4,
      reachableStepCount: 3,
      unreachableStepCount: 1,
      terminalStepIds: ["orphan", "done"],
      shadowedTransitionCount: 1,
      terminalPathExists: true
    });
    expect(result.summary.cycleCount).toBeGreaterThan(0);
  });

  it("flags journeys with no reachable terminal step", () => {
    const result = analyzeStructure({
      steps: { a: { on: { GO: "b" } }, b: { on: { BACK: "a" } } },
      initial: "a"
    });
    expect(result.issues.map((issue) => issue.code)).toContain("no-terminal-path");
    expect(result.summary.terminalPathExists).toBe(false);
  });

  it("a clean pipeline produces no issues", () => {
    const result = analyzeStructure({
      steps: { a: { on: { NEXT: "b" } }, b: { on: { NEXT: "done" } }, done: {} },
      initial: "a"
    });
    expect(result.issues).toEqual([]);
  });
});

describe("analyzing a definition without a machine", () => {
  it("reports the same structure the runtime would build from it", () => {
    const result = analyzeStructure({
      steps: { a: { on: { GO: "b" } }, b: {}, orphan: {} },
      initial: "a"
    });
    expect(result.issues.map((issue) => issue.code)).toContain("unreachable-step");
    expect(result.summary.terminalStepIds).toEqual(["b", "orphan"]);
  });
});

describe("diagnostics traversal edges", () => {
  it("deduplicates cycles reached from multiple entry points", () => {
    // a -> b -> c -> b (cycle entered twice: via b directly and via c)
    const result = analyzeStructure({
      steps: {
        a: { on: { START: "b", SKIP: "c" } },
        b: { on: { NEXT: "c" } },
        c: { on: { BACK: "b", FINISH: "done" } },
        done: {}
      },
      initial: "a"
    });
    expect(result.summary.cycleCount).toBe(1);
    expect(result.summary.terminalPathExists).toBe(true);
  });
});

describe("guarded transitions", () => {
  it("guarded candidates never shadow later ones", () => {
    const result = analyzeStructure({
      steps: {
        a: { on: { GO: [{ to: "done", when: () => false }, { to: "b" }] } },
        b: { on: { FINISH: "done" } },
        done: {}
      },
      initial: "a"
    });
    expect(result.summary.shadowedTransitionCount).toBe(0);
    expect(result.issues).toEqual([]);
  });
});
