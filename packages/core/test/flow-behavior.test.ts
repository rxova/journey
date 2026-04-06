import { describe, expect, it } from "vitest";

import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";
import { getExecutionPaths } from "@rxova/journey-core/execution-paths";
import type { JourneyTransitionGraph } from "../src/types";

type StepId = "start" | "details" | "extra" | "review" | "confirmExit";
type EventMap = { requestClose: unknown };
type Context = { includeDetails: boolean; dirty: boolean };

const createJourney = (): JourneyDefinition<Context, StepId, EventMap> => ({
  initial: "start",
  context: { includeDetails: false, dirty: false },
  steps: {
    start: {},
    details: {},
    extra: {},
    review: {},
    confirmExit: {}
  },
  transitions: {
    start: { goToNextStep: [{ label: "start-next", to: "details" }] },
    details: {
      goToNextStep: [
        {
          label: "details-next-extra",
          to: "extra",
          when: ({ context }) => context.includeDetails
        },
        {
          label: "details-next-review",
          to: "review",
          when: ({ context }) => !context.includeDetails
        }
      ]
    },
    extra: { goToNextStep: [{ label: "extra-next-review", to: "review" }] },
    global: {
      requestClose: [
        {
          label: "close-dirty",
          to: "confirmExit",
          when: ({ context }: { context: Context }) => context.dirty
        }
      ],
      terminateJourney: [{ label: "close-clean" }]
    }
  }
});

describe("flow behavior", () => {
  it("enumerates structural execution paths from step-local transitions", () => {
    const journey = {
      initial: "start",
      context: { includeDetails: false, dirty: false },
      steps: {
        start: {},
        details: {},
        extra: {},
        review: {},
        confirmExit: {}
      },
      transitions: {
        start: { goToNextStep: [{ to: "details" }] },
        details: { goToNextStep: [{ to: "extra" }, { to: "review" }] },
        extra: { goToNextStep: [{ to: "review" }] }
      }
    } satisfies JourneyDefinition<Context, StepId>;
    const result = getExecutionPaths(journey);

    expect(result.paths).toEqual([
      {
        steps: ["start", "details", "extra", "review"],
        events: ["goToNextStep", "goToNextStep", "goToNextStep"],
        terminated: "final"
      },
      {
        steps: ["start", "details", "review"],
        events: ["goToNextStep", "goToNextStep"],
        terminated: "final"
      }
    ]);
    expect(result.truncated).toBe(false);
    expect(result.cyclesDetected).toBe(false);
  });

  it("supports branch-like behavior via first-match transitions", async () => {
    const machine = createJourneyMachine(createJourney());
    machine.startJourney();

    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });

    expect(machine.getSnapshot().currentStepId).toBe("review");

    machine.resetJourney();
    machine.updateContext((context) => ({ ...context, includeDetails: true }));
    machine.startJourney();

    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });

    expect(machine.getSnapshot().currentStepId).toBe("extra");
  });

  it("preserves first-match-wins semantics", async () => {
    const journey = createJourney();
    const transitions = journey.transitions as JourneyTransitionGraph<Context, StepId, EventMap>;
    journey.transitions = {
      ...transitions,
      start: {
        ...transitions.start,
        goToNextStep: [
          {
            label: "early",
            to: "review"
          },
          ...(transitions.start?.goToNextStep ?? [])
        ]
      }
    };

    const machine = createJourneyMachine(journey);
    machine.startJourney();
    const result = await machine.send({ type: "goToNextStep" });

    expect(result.transitioned).toBe(true);
    expect(result.transitionId).toEqual(expect.any(String));
    expect(result.label).toBe("early");
    expect(machine.getSnapshot().currentStepId).toBe("review");
  });

  it("supports wildcard close transitions", async () => {
    const machine = createJourneyMachine(createJourney());
    machine.startJourney();

    machine.updateContext((context) => ({ ...context, dirty: true }));
    await machine.send({ type: "requestClose" });

    expect(machine.getSnapshot().currentStepId).toBe("confirmExit");
  });
});
