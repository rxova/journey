import { describe, expect, it } from "vitest";

import type { JourneyDefinition } from "@rxova/journey-core";
import type { JourneyResolvedDefinition } from "../src/types";
import { getExecutionPaths } from "@rxova/journey-core/execution-paths";

describe("execution paths", () => {
  it("supports linear string-array shorthand", () => {
    const journey = {
      context: {},
      steps: {
        start: {},
        details: {},
        review: {}
      },
      transitions: ["start", "details", "review"] as const
    } satisfies JourneyDefinition<Record<string, never>, "start" | "details" | "review">;

    expect(getExecutionPaths(journey)).toEqual({
      paths: [
        {
          steps: ["start", "details", "review"],
          events: ["goToNextStep", "goToNextStep"],
          terminated: "final"
        }
      ],
      truncated: false,
      cyclesDetected: false
    });
  });

  it("supports linear object-entry shorthand", () => {
    const journey = {
      context: {},
      steps: {
        start: {},
        details: {},
        review: {}
      },
      transitions: [
        "start",
        {
          step: "details",
          id: "start-next"
        },
        "review"
      ] as const
    } satisfies JourneyDefinition<Record<string, never>, "start" | "details" | "review">;

    expect(getExecutionPaths(journey)).toEqual({
      paths: [
        {
          steps: ["start", "details", "review"],
          events: ["goToNextStep", "goToNextStep"],
          terminated: "final"
        }
      ],
      truncated: false,
      cyclesDetected: false
    });
  });

  it("linear path produces one final path", () => {
    const journey: JourneyDefinition<Record<string, never>, "a" | "b" | "c"> = {
      initial: "a",
      context: {},
      steps: {
        a: {},
        b: {},
        c: {}
      },
      transitions: {
        a: { goToNextStep: [{ to: "b" }] },
        b: { goToNextStep: [{ to: "c" }] },
        c: { goToNextStep: [{ to: "COMPLETE" }] }
      }
    };

    expect(getExecutionPaths(journey)).toEqual({
      paths: [
        {
          steps: ["a", "b", "c"],
          events: ["goToNextStep", "goToNextStep", "goToNextStep"],
          terminated: "final"
        }
      ],
      truncated: false,
      cyclesDetected: false
    });
  });

  it("branching transitions produce multiple paths", () => {
    const journey: JourneyDefinition<Record<string, never>, "a" | "b" | "c", { skip: unknown }> = {
      initial: "a",
      context: {},
      steps: {
        a: {},
        b: {},
        c: {}
      },
      transitions: {
        a: {
          goToNextStep: [{ to: "b" }],
          skip: [{ to: "c" }]
        },
        b: { goToNextStep: [{ to: "COMPLETE" }] },
        c: { goToNextStep: [{ to: "COMPLETE" }] }
      }
    };

    const result = getExecutionPaths(journey);

    expect(result.paths).toEqual([
      {
        steps: ["a", "b"],
        events: ["goToNextStep", "goToNextStep"],
        terminated: "final"
      },
      {
        steps: ["a", "c"],
        events: ["skip", "goToNextStep"],
        terminated: "final"
      }
    ]);
    expect(result.truncated).toBe(false);
    expect(result.cyclesDetected).toBe(false);
  });

  it("detects cycles", () => {
    const journey = {
      initial: "a",
      context: {},
      steps: {
        a: {},
        b: {}
      },
      transitions: {
        a: { goToNextStep: [{ to: "b" }] },
        b: { goToNextStep: [{ to: "a" }] }
      }
    } satisfies JourneyDefinition<Record<string, never>, "a" | "b">;

    expect(getExecutionPaths(journey)).toEqual({
      paths: [
        {
          steps: ["a", "b", "a"],
          events: ["goToNextStep", "goToNextStep"],
          terminated: "cycle"
        }
      ],
      truncated: false,
      cyclesDetected: true
    });
  });

  it("applies maxDepth and maxPaths limits", () => {
    const journey: JourneyDefinition<
      Record<string, never>,
      "s1" | "s2" | "s3" | "s4" | "s5" | "s6",
      { goA: unknown; goB: unknown }
    > = {
      initial: "s1",
      context: {},
      steps: {
        s1: {},
        s2: {},
        s3: {},
        s4: {},
        s5: {},
        s6: {}
      },
      transitions: {
        s1: {
          goA: [{ to: "s2" }],
          goB: [{ to: "s3" }]
        },
        s2: { goToNextStep: [{ to: "s4" }] },
        s3: { goToNextStep: [{ to: "s5" }] },
        s4: { goToNextStep: [{ to: "s6" }] },
        s5: { goToNextStep: [{ to: "COMPLETE" }] }
      }
    };

    expect(getExecutionPaths(journey, { maxPaths: 1 })).toEqual({
      paths: [
        {
          steps: ["s1", "s2", "s4", "s6"],
          events: ["goA", "goToNextStep", "goToNextStep"],
          terminated: "final"
        }
      ],
      truncated: true,
      cyclesDetected: false
    });

    expect(getExecutionPaths(journey, { maxDepth: 2 })).toEqual({
      paths: [
        {
          steps: ["s1", "s2", "s4"],
          events: ["goA", "goToNextStep"],
          terminated: "depth"
        },
        {
          steps: ["s1", "s3", "s5"],
          events: ["goB", "goToNextStep"],
          terminated: "depth"
        }
      ],
      truncated: true,
      cyclesDetected: false
    });
  });

  it("reports final nodes at the maxDepth boundary instead of depth-truncated", () => {
    const journey: JourneyDefinition<Record<string, never>, "a" | "b"> = {
      initial: "a",
      context: {},
      steps: { a: {}, b: {} },
      transitions: ["a", "b"]
    };

    const result = getExecutionPaths(journey, { maxDepth: 1 });

    expect(result).toEqual({
      paths: [
        {
          steps: ["a", "b"],
          events: ["goToNextStep"],
          terminated: "final"
        }
      ],
      truncated: false,
      cyclesDetected: false
    });
  });

  it("includes wildcard global transitions in the graph", () => {
    const journey: JourneyDefinition<Record<string, never>, "a" | "b" | "confirmExit"> = {
      initial: "a",
      context: {},
      steps: {
        a: {},
        b: {},
        confirmExit: {}
      },
      transitions: {
        a: { goToNextStep: [{ to: "b" }] },
        b: { goToNextStep: [{ to: "COMPLETE" }] },
        global: { terminateJourney: [{}] }
      }
    };

    const result = getExecutionPaths(journey, { maxPaths: 20 });

    expect(result.paths.some((path) => path.events.includes("terminateJourney"))).toBe(true);
    expect(result.paths.some((path) => path.events.includes("goToNextStep"))).toBe(true);
  });

  it("includes declared goToStepById edges in returned execution-path events", () => {
    const journey = {
      initial: "start",
      context: {},
      steps: {
        start: {},
        review: {}
      },
      transitions: {
        start: {
          goToStepById: [{ to: "review" }]
        },
        review: {
          completeJourney: [{}]
        }
      }
    } satisfies JourneyDefinition<Record<string, never>, "start" | "review">;

    expect(getExecutionPaths(journey)).toEqual({
      paths: [
        {
          steps: ["start", "review"],
          events: ["goToStepById", "completeJourney"],
          terminated: "final"
        }
      ],
      truncated: false,
      cyclesDetected: false
    });
  });

  it("treats dead-end steps as final", () => {
    const journey = {
      initial: "lonely",
      context: {},
      steps: {
        lonely: {}
      }
    } satisfies JourneyDefinition<Record<string, never>, "lonely">;

    expect(getExecutionPaths(journey)).toEqual({
      paths: [
        {
          steps: ["lonely"],
          events: [],
          terminated: "final"
        }
      ],
      truncated: false,
      cyclesDetected: false
    });
  });

  it("accepts already-resolved journeys and normalizes invalid limits to defaults", () => {
    const resolvedJourney = {
      initial: "a",
      context: {},
      steps: {
        a: {},
        b: {}
      },
      transitions: [
        { from: "a", event: "goToNextStep", to: "b" },
        { from: "b", event: "goToNextStep", to: "COMPLETE" }
      ]
    } satisfies JourneyResolvedDefinition<Record<string, never>, "a" | "b">;

    expect(
      getExecutionPaths(resolvedJourney, {
        maxDepth: Number.NaN,
        maxPaths: Number.POSITIVE_INFINITY
      })
    ).toEqual({
      paths: [
        {
          steps: ["a", "b"],
          events: ["goToNextStep", "goToNextStep"],
          terminated: "final"
        }
      ],
      truncated: false,
      cyclesDetected: false
    });
  });

  it("truncates when an earlier sibling path already exhausts maxPaths", () => {
    const journey: JourneyDefinition<Record<string, never>, "a" | "b"> = {
      initial: "a",
      context: {},
      steps: {
        a: {},
        b: {}
      },
      transitions: {
        a: {
          completeJourney: [{}],
          terminateJourney: [{}],
          goToNextStep: [{ to: "b" }]
        },
        b: { goToNextStep: [{ to: "COMPLETE" }] }
      }
    };

    expect(getExecutionPaths(journey, { maxPaths: 2 })).toEqual({
      paths: [
        {
          steps: ["a"],
          events: ["completeJourney"],
          terminated: "final"
        },
        {
          steps: ["a"],
          events: ["terminateJourney"],
          terminated: "final"
        }
      ],
      truncated: true,
      cyclesDetected: false
    });
  });

  it("truncates after a recursive branch fills the remaining path budget", () => {
    type BranchEventMap = { left: unknown; right: unknown; leftA: unknown; leftB: unknown };
    const journey: JourneyDefinition<
      Record<string, never>,
      "start" | "left" | "right" | "leftA" | "leftB" | "finish",
      BranchEventMap
    > = {
      initial: "start",
      context: {},
      steps: {
        start: {},
        left: {},
        right: {},
        leftA: {},
        leftB: {},
        finish: {}
      },
      transitions: {
        start: {
          left: [{ to: "left" }],
          right: [{ to: "right" }]
        },
        left: {
          leftA: [{ to: "leftA" }],
          leftB: [{ to: "leftB" }]
        },
        leftA: {
          goToNextStep: [{ to: "finish" }]
        },
        leftB: {
          goToNextStep: [{ to: "finish" }]
        },
        right: {
          goToNextStep: [{ to: "finish" }]
        }
      }
    };

    const result = getExecutionPaths(journey, { maxPaths: 2 });

    expect(result.paths).toEqual([
      {
        steps: ["start", "left", "leftA", "finish"],
        events: ["left", "leftA", "goToNextStep"],
        terminated: "final"
      },
      {
        steps: ["start", "left", "leftB", "finish"],
        events: ["left", "leftB", "goToNextStep"],
        terminated: "final"
      }
    ]);
    expect(result.truncated).toBe(true);
    expect(result.cyclesDetected).toBe(false);
  });

  it("returns the real path with maxPaths: 1 on a simple linear journey", () => {
    const journey = {
      initial: "start",
      context: {},
      steps: {
        start: {},
        next: {}
      },
      transitions: {
        start: { goToNextStep: [{ to: "next" }] },
        next: { completeJourney: [{}] }
      }
    } satisfies JourneyDefinition<Record<string, never>, "start" | "next">;

    expect(getExecutionPaths(journey, { maxPaths: 1 })).toEqual({
      paths: [
        {
          steps: ["start", "next"],
          events: ["goToNextStep", "completeJourney"],
          terminated: "final"
        }
      ],
      truncated: true,
      cyclesDetected: false
    });
  });
});
