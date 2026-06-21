import { describe, expect, it } from "vitest";

import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";
import { createDiagnosticsPlugin, getJourneyDiagnostics } from "@rxova/journey-core/diagnostics";

type StepId = "start" | "review" | "dead" | "loop";
type Context = { count: number };
type EventMap = { retry: unknown };

describe("diagnostics plugin", () => {
  it("reports structural issues for graph journeys", () => {
    const journey: JourneyDefinition<Context, StepId, EventMap> = {
      initial: "start",
      context: { count: 0 },
      steps: {
        start: {},
        review: {},
        dead: {},
        loop: {}
      },
      transitions: {
        start: {
          goToNextStep: [
            { label: "dup", to: "review" },
            { label: "shadowed", to: "dead" }
          ]
        },
        review: {
          retry: [{ label: "dup", to: "loop" }]
        },
        loop: {
          goToNextStep: [{ to: "loop" }]
        }
      }
    };

    const diagnostics = getJourneyDiagnostics(journey);

    expect(diagnostics.summary.unreachableStepCount).toBe(1);
    expect(diagnostics.summary.shadowedTransitionCount).toBe(1);
    expect(diagnostics.summary.cycleCount).toBe(1);
    expect(diagnostics.summary.terminalPathExists).toBe(false);
    expect(diagnostics.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "shadowed-transition",
          transitionId: expect.any(String),
          label: "shadowed"
        }),
        expect.objectContaining({
          code: "unreachable-step",
          stepId: "dead"
        }),
        expect.objectContaining({
          code: "cycle-detected",
          steps: ["loop", "loop"]
        }),
        expect.objectContaining({
          code: "no-terminal-path"
        })
      ])
    );
  });

  it("flags a linear final step when explicit completion is required", () => {
    const journey: JourneyDefinition<Context, "start" | "review"> = {
      initial: "start",
      context: { count: 0 },
      steps: {
        start: {},
        review: {}
      },
      transitions: ["start", "review"] as const
    };

    const diagnostics = getJourneyDiagnostics(journey, {
      requireExplicitCompletion: true
    });

    expect(diagnostics.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "dead-end-step",
          stepId: "review"
        })
      ])
    );
    expect(diagnostics.summary.terminalPathExists).toBe(false);
  });

  it("treats the last linear object entry as an implicit terminal step by default", () => {
    const journey = {
      initial: "start",
      context: { count: 0 },
      steps: {
        start: {},
        review: {}
      },
      transitions: ["start", { step: "review", label: "start-review" }] as const
    } satisfies JourneyDefinition<Context, "start" | "review">;

    const diagnostics = getJourneyDiagnostics(journey);

    expect(diagnostics.summary.deadEndCount).toBe(0);
    expect(diagnostics.summary.terminalPathExists).toBe(true);
    expect(diagnostics.issues.some((issue) => issue.code === "dead-end-step")).toBe(false);
    expect(diagnostics.issues.some((issue) => issue.code === "no-terminal-path")).toBe(false);
  });

  it("skips graph-only checks for headless journeys", () => {
    const journey = {
      initial: "start",
      context: { count: 0 },
      steps: {
        start: {},
        review: {},
        done: {}
      }
    } satisfies JourneyDefinition<Context, "start" | "review" | "done">;

    const diagnostics = getJourneyDiagnostics(journey);

    expect(diagnostics.issues).toEqual([]);
    expect(diagnostics.summary.graphChecksSkipped).toBe(true);
  });

  it("reports unnamed shadowing blockers and respects explicit terminal exits", () => {
    const journey = {
      initial: "start",
      context: { count: 0 },
      steps: {
        start: {},
        review: {},
        dead: {}
      },
      transitions: {
        start: {
          goToNextStep: [{ to: "review" }, { label: "shadowed", to: "dead" }],
          retry: [{ to: "dead" }]
        },
        review: {
          completeJourney: [{}]
        },
        dead: {
          terminateJourney: [{}]
        }
      }
    } satisfies JourneyDefinition<Context, "start" | "review" | "dead", EventMap>;

    const diagnostics = getJourneyDiagnostics(journey);

    expect(diagnostics.summary.shadowedTransitionCount).toBe(1);
    expect(diagnostics.summary.deadEndCount).toBe(0);
    expect(diagnostics.summary.terminalPathExists).toBe(true);
    expect(diagnostics.issues).toContainEqual(
      expect.objectContaining({
        code: "shadowed-transition",
        transitionId: expect.any(String),
        label: "shadowed",
        message: expect.stringContaining("shadowed by unconditional transition")
      })
    );
    expect(diagnostics.issues.some((issue) => issue.code === "no-terminal-path")).toBe(false);
  });

  it("memoizes non-terminal shared branches when checking terminal reachability", () => {
    const journey = {
      initial: "start",
      context: { count: 0 },
      steps: {
        start: {},
        left: {},
        right: {},
        loop: {}
      },
      transitions: {
        start: {
          goToNextStep: [{ to: "left" }],
          retry: [{ to: "right" }]
        },
        left: {
          goToNextStep: [{ to: "loop" }]
        },
        right: {
          goToNextStep: [{ to: "loop" }]
        },
        loop: {
          retry: [{ to: "loop" }]
        }
      }
    };

    const diagnostics = getJourneyDiagnostics(journey);

    expect(diagnostics.summary.reachableStepCount).toBe(4);
    expect(diagnostics.summary.cycleCount).toBe(1);
    expect(diagnostics.summary.terminalPathExists).toBe(false);
    expect(diagnostics.issues).toContainEqual(
      expect.objectContaining({
        code: "no-terminal-path",
        stepId: "start"
      })
    );
  });

  it("ignores conditional blockers, omits missing transition ids, and deduplicates cycles", () => {
    const journey: JourneyDefinition<Context, "start" | "left" | "loop", EventMap> = {
      initial: "start",
      context: { count: 0 },
      steps: {
        start: {},
        left: {},
        loop: {}
      },
      transitions: {
        start: {
          goToNextStep: [
            { to: "left", when: ({ context }: { context: Context }) => context.count === 0 },
            { to: "left" },
            { to: "loop" }
          ]
        },
        left: {
          retry: [{ to: "loop" }]
        },
        loop: {
          goToNextStep: [{ label: "loop-left", to: "left" }],
          retry: [{ to: "left" }]
        }
      }
    };

    const diagnostics = getJourneyDiagnostics(journey);
    const shadowedIssue = diagnostics.issues.find((issue) => issue.code === "shadowed-transition");
    const cycleIssues = diagnostics.issues.filter((issue) => issue.code === "cycle-detected");

    expect(diagnostics.summary.shadowedTransitionCount).toBe(1);
    expect(diagnostics.summary.cycleCount).toBe(1);
    expect(shadowedIssue).toBeDefined();
    expect(shadowedIssue?.transitionId).toEqual(expect.any(String));
    expect(shadowedIssue?.message).toContain("shadowed by unconditional transition");
    expect(cycleIssues).toContainEqual(
      expect.objectContaining({
        transitionId: expect.any(String),
        label: "loop-left",
        steps: ["left", "loop", "left"]
      })
    );
  });

  it("augments the machine with getDiagnostics()", () => {
    const machine = createJourneyMachine(
      {
        initial: "start",
        context: { count: 0 },
        steps: {
          start: {},
          review: {}
        },
        transitions: ["start", "review"]
      } satisfies JourneyDefinition<Context, "start" | "review">,
      {
        plugins: [createDiagnosticsPlugin()] as const
      }
    );

    const diagnostics = machine.getDiagnostics();

    expect(diagnostics.summary.stepCount).toBe(2);
    expect(diagnostics.summary.unreachableStepCount).toBe(0);
  });

  it("reports effect/after edges with public labels, never internal @@journey.* names", () => {
    // The effect routes back to "start", forming a cycle through the effect edge.
    const journey: JourneyDefinition<Record<string, never>, "start" | "loading"> = {
      initial: "start",
      context: {},
      steps: {
        start: {},
        loading: {
          effect: {
            run: async () => "x",
            onResolved: { to: "start" }
          }
        }
      },
      transitions: {
        start: { goToNextStep: [{ to: "loading" }] },
        loading: {}
      }
    };

    const diagnostics = getJourneyDiagnostics(journey);

    // No issue surfaces an internal synthetic event name.
    expect(
      diagnostics.issues.every(
        (issue) =>
          !String((issue as { eventType?: unknown }).eventType ?? "").startsWith("@@journey.")
      )
    ).toBe(true);
    // The cycle closed by the effect edge is reported with a public label.
    expect(
      diagnostics.issues.some(
        (issue) => issue.code === "cycle-detected" && String(issue.eventType) === "effect.resolved"
      )
    ).toBe(true);
  });
});
