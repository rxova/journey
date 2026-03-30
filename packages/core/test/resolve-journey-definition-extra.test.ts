import { describe, expect, it } from "vitest";

import { resolveJourneyDefinition } from "../src/journey-machine/resolve-journey-definition";

import type { JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "details" | "review";
type EventMap = { submit: unknown };
type Context = { count: number };

const createJourney = (): JourneyDefinition<Context, StepId, EventMap> => ({
  initial: "start",
  context: { count: 0 },
  steps: {
    start: {},
    details: {},
    review: {}
  }
});

describe("resolveJourneyDefinition extra coverage", () => {
  it("honors explicit initial steps and serializes lifecycle hooks in linear transitions", () => {
    const updateContext = ({ context }: { context: Context }) => ({
      ...context,
      count: context.count + 1
    });
    const onEnter = () => undefined;
    const onLeave = () => undefined;

    const resolved = resolveJourneyDefinition({
      ...createJourney(),
      initial: "details",
      transitions: [
        "start",
        {
          step: "details",
          id: "start-next",
          updateContext,
          onEnter,
          onLeave,
          timeoutMs: 100
        },
        "review"
      ] as const
    });

    expect(resolved.initial).toBe("details");
    expect(resolved.transitions).toEqual([
      {
        from: "start",
        event: "goToNextStep",
        to: "details",
        id: "start-next",
        updateContext,
        onEnter,
        onLeave,
        timeoutMs: 100
      },
      { from: "details", event: "goToNextStep", to: "review" }
    ]);
  });

  it("rejects missing explicit initials and non-function lifecycle hooks", () => {
    expect(() =>
      resolveJourneyDefinition({
        ...createJourney(),
        initial: "review",
        transitions: ["start", "details"] as never
      })
    ).toThrow('Journey initial step "review" does not exist in linear transitions.');

    expect(() =>
      resolveJourneyDefinition({
        ...createJourney(),
        transitions: ["start", { step: "details", onEnter: true }] as never
      })
    ).toThrow(
      'Journey linear transition object at index 1 must define "onEnter" as a function when provided.'
    );

    expect(() =>
      resolveJourneyDefinition({
        ...createJourney(),
        transitions: ["start", { step: "details", onLeave: true }] as never
      })
    ).toThrow(
      'Journey linear transition object at index 1 must define "onLeave" as a function when provided.'
    );
  });
});
