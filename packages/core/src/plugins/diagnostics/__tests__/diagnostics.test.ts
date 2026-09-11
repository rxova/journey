import { describe, expect, it } from "vitest";
import { createGraphJourney, createLinearJourney } from "@rxova/journey-core";
import { createDiagnosticsPlugin, getGraphDiagnostics } from "@rxova/journey-core/diagnostics";

describe("getGraphDiagnostics", () => {
  it("reports unreachable steps, shadowed transitions, cycles, and terminal facts", () => {
    const result = getGraphDiagnostics({
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
      kind: "graph",
      stepCount: 4,
      reachableStepCount: 3,
      unreachableStepCount: 1,
      terminalStepIds: ["orphan", "done"],
      shadowedTransitionCount: 1,
      terminalPathExists: true,
      graphChecksSkipped: false
    });
    expect(result.summary.cycleCount).toBeGreaterThan(0);
  });

  it("flags journeys with no reachable terminal step", () => {
    const result = getGraphDiagnostics({
      steps: { a: { on: { GO: "b" } }, b: { on: { BACK: "a" } } },
      initial: "a"
    });
    expect(result.issues.map((issue) => issue.code)).toContain("no-terminal-path");
    expect(result.summary.terminalPathExists).toBe(false);
  });

  it("a clean pipeline produces no issues", () => {
    const result = getGraphDiagnostics({
      steps: { a: { on: { NEXT: "b" } }, b: { on: { NEXT: "done" } }, done: {} },
      initial: "a"
    });
    expect(result.issues).toEqual([]);
  });
});

describe("diagnostics plugin", () => {
  it("analyzes the running machine's structure through the host", () => {
    const machine = createGraphJourney(
      {
        steps: { a: { on: { GO: "b" } }, b: {}, orphan: {} },
        initial: "a",
        context: {}
      },
      { plugins: [createDiagnosticsPlugin()] as const }
    );

    const result = machine.plugins.diagnostics.getDiagnostics();
    expect(result.issues.map((issue) => issue.code)).toContain("unreachable-step");
    expect(result.summary.terminalStepIds).toEqual(["b", "orphan"]);
    // cached: same object identity on second call
    expect(machine.plugins.diagnostics.getDiagnostics()).toBe(result);
  });

  it("skips graph checks for linear journeys", () => {
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: {} },
      { plugins: [createDiagnosticsPlugin()] as const }
    );
    const result = machine.plugins.diagnostics.getDiagnostics();
    expect(result.issues).toEqual([]);
    expect(result.summary.graphChecksSkipped).toBe(true);
  });
});

describe("diagnostics traversal edges", () => {
  it("deduplicates cycles reached from multiple entry points", () => {
    // a -> b -> c -> b (cycle entered twice: via b directly and via c)
    const result = getGraphDiagnostics({
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
    const result = getGraphDiagnostics({
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
