import { describe, expect, it } from "vitest";
import { analyzeStructure } from "@rxova/journey-core";

/**
 * Modelling a dependency graph (which repo depends on which) in a definition.
 *
 * Candidates declared under one event are *alternatives* — routing takes the
 * first enabled one — so several unguarded candidates on a single event are a
 * declaration mistake, not a fan-out. A dependency graph wants fan-out, so each
 * edge needs its own event name. These two tests pin that difference, because
 * the failing shape fails quietly: it analyzes cleanly as a journey while
 * answering the wrong question as a graph.
 */
describe("modelling a dependency graph", () => {
  it("collapses a fan-out declared under a single event", () => {
    const result = analyzeStructure({
      initial: "api",
      steps: {
        api: { on: { dependsOn: [{ to: "auth" }, { to: "billing" }, { to: "search" }] } },
        auth: { on: { dependsOn: [{ to: "db" }] } },
        billing: {},
        search: {},
        db: {},
      },
    });

    // Every candidate after the first unguarded one is dead for routing.
    expect(result.summary.shadowedTransitionCount).toBe(2);
    expect(result.issues.filter((issue) => issue.code === "shadowed-transition")).toHaveLength(2);
    // And so the walk never sees them: 3 of 5 instead of all 5.
    expect(result.summary.reachableStepCount).toBe(3);
    expect(
      result.issues.filter((issue) => issue.code === "unreachable-step").map((i) => i.stepId),
    ).toEqual(["billing", "search"]);
  });

  it("keeps the whole graph when each edge declares its own event", () => {
    const result = analyzeStructure({
      initial: "api",
      steps: {
        api: { on: { "dep:auth": "auth", "dep:billing": "billing", "dep:search": "search" } },
        auth: { on: { "dep:db": "db" } },
        billing: {},
        search: {},
        db: {},
      },
    });

    expect(result.issues).toEqual([]);
    expect(result.summary.reachableStepCount).toBe(5);
    expect(result.summary.shadowedTransitionCount).toBe(0);
  });

  it("reports a dependency cycle once each edge has its own event", () => {
    const result = analyzeStructure({
      initial: "a",
      steps: {
        a: { on: { "dep:b": "b" } },
        b: { on: { "dep:c": "c" } },
        c: { on: { "dep:a": "a" } },
      },
    });

    expect(result.summary.cycleCount).toBe(1);
  });
});
