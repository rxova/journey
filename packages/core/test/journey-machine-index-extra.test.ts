import { describe, expect, it, vi } from "vitest";

import {
  createJourneyMachine,
  JourneyDisposedError,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = "start" | "review" | "done";
type Context = { count: number };

const createJourney = (
  transitionHooks: Partial<{ onEnter: () => void; onLeave: () => void }> = {}
): JourneyDefinition<Context, StepId> => ({
  initial: "start",
  context: { count: 0 },
  steps: {
    start: {},
    review: {},
    done: {}
  },
  transitions: {
    start: {
      goToNextStep: [
        {
          to: "review",
          ...transitionHooks
        }
      ]
    },
    review: {
      goToNextStep: [{ to: "done" }],
      completeJourney: [{}]
    }
  }
});

describe("createJourneyMachine extra coverage", () => {
  it("runs transition-level lifecycle hooks", async () => {
    const onEnter = vi.fn();
    const onLeave = vi.fn();
    const machine = createJourneyMachine(createJourney({ onEnter, onLeave }));

    await machine.startJourney();
    await machine.goToNextStep();

    expect(onLeave).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "start",
        to: "review",
        transitionId: expect.any(String)
      })
    );
    expect(onEnter).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "start",
        to: "review",
        transitionId: expect.any(String)
      })
    );
  });

  it("returns disposed errors for previous and last-visited navigation after dispose", async () => {
    const machine = createJourneyMachine(createJourney());

    await machine.startJourney();
    machine.dispose();

    const previous = await machine.goToPreviousStep();
    const lastVisited = await machine.goToLastVisitedStep();

    expect(previous.error).toBeInstanceOf(JourneyDisposedError);
    expect(lastVisited.error).toBeInstanceOf(JourneyDisposedError);
  });

  it("rejects primitive transition definitions when provided", () => {
    expect(() =>
      createJourneyMachine({
        ...createJourney(),
        transitions: 1 as never
      })
    ).toThrow(/must be an array or an object map/i);
  });

  it("requires an initial step for graph-style journey definitions", () => {
    expect(() =>
      createJourneyMachine({
        context: { count: 0 },
        steps: {
          start: {},
          review: {}
        },
        transitions: {
          start: {
            goToNextStep: [{ to: "review" }]
          }
        }
      } as never)
    ).toThrow(/initial.*required/i);
  });
});
