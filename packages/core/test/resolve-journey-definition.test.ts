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

describe("resolveJourneyDefinition", () => {
  it("returns an empty transition list when transitions are omitted", () => {
    const resolved = resolveJourneyDefinition(createJourney());

    expect(resolved.transitions).toEqual([]);
  });

  it("expands linear transitions into goToNextStep edges", () => {
    const resolved = resolveJourneyDefinition({
      ...createJourney(),
      transitions: ["start", "details", "review"] as const
    });

    expect(resolved.transitions).toEqual([
      { from: "start", event: "goToNextStep", to: "details" },
      { from: "details", event: "goToNextStep", to: "review" }
    ]);
  });

  it("expands linear step objects into annotated goToNextStep edges", () => {
    const updateContext = ({ context }: { context: Context }) => ({
      ...context,
      count: context.count + 1
    });
    const resolved = resolveJourneyDefinition({
      ...createJourney(),
      transitions: [
        "start",
        {
          step: "details",
          id: "start-next",
          updateContext,
          timeoutMs: 100
        },
        "review"
      ] as const
    });

    expect(resolved.transitions).toEqual([
      {
        from: "start",
        event: "goToNextStep",
        to: "details",
        id: "start-next",
        updateContext,
        timeoutMs: 100
      },
      { from: "details", event: "goToNextStep", to: "review" }
    ]);
  });

  it("rejects invalid linear transition definitions", () => {
    expect(() =>
      resolveJourneyDefinition({
        ...createJourney(),
        transitions: ["start", 7] as never
      })
    ).toThrow(
      "Journey linear transitions at index 1 must be a step id string or step config object."
    );

    expect(() =>
      resolveJourneyDefinition({
        ...createJourney(),
        transitions: ["start", "missing"] as never
      })
    ).toThrow('Journey linear transitions reference unknown step "missing".');

    expect(() =>
      resolveJourneyDefinition({
        ...createJourney(),
        transitions: [] as never
      })
    ).toThrow("Journey linear transitions must include the initial step as the first item.");

    expect(() =>
      resolveJourneyDefinition({
        ...createJourney(),
        transitions: ["start", {}] as never
      })
    ).toThrow('Journey linear transition object at index 1 must define string "step".');

    expect(() =>
      resolveJourneyDefinition({
        ...createJourney(),
        transitions: ["start", { step: "details", when: () => true }] as never
      })
    ).toThrow(
      'Journey linear transition object at index 1 contains unsupported field "when". Allowed fields are "step", "id", "updateContext", "onEnter", "onLeave", and "timeoutMs".'
    );

    expect(() =>
      resolveJourneyDefinition({
        ...createJourney(),
        transitions: ["start", { step: "details", to: "review" }] as never
      })
    ).toThrow(
      'Journey linear transition object at index 1 contains unsupported field "to". Allowed fields are "step", "id", "updateContext", "onEnter", "onLeave", and "timeoutMs".'
    );
  });

  it("rejects linear transitions with duplicate steps", () => {
    expect(() =>
      resolveJourneyDefinition({
        ...createJourney(),
        transitions: ["start", "details", "review", "details"] as never
      })
    ).toThrow('Journey linear transitions contain duplicate step "details" at index 3.');

    expect(() =>
      resolveJourneyDefinition({
        ...createJourney(),
        transitions: ["start", { step: "details" }, { step: "details" }] as never
      })
    ).toThrow('Journey linear transitions contain duplicate step "details" at index 2.');

    expect(() =>
      resolveJourneyDefinition({
        ...createJourney(),
        transitions: ["start", "details", { step: "start" }] as never
      })
    ).toThrow('Journey linear transitions contain duplicate step "start" at index 2.');
  });

  it("rejects linear transition objects with non-function updateContext", () => {
    expect(() =>
      resolveJourneyDefinition({
        ...createJourney(),
        transitions: ["start", { step: "details", updateContext: "not a function" }] as never
      })
    ).toThrow(
      'Journey linear transition object at index 1 must define "updateContext" as a function when provided.'
    );
  });

  it("rejects linear transition objects with invalid timeoutMs", () => {
    expect(() =>
      resolveJourneyDefinition({
        ...createJourney(),
        transitions: ["start", { step: "details", timeoutMs: "fast" }] as never
      })
    ).toThrow(
      'Journey linear transition object at index 1 must define a finite numeric "timeoutMs" when provided.'
    );

    expect(() =>
      resolveJourneyDefinition({
        ...createJourney(),
        transitions: ["start", { step: "details", timeoutMs: NaN }] as never
      })
    ).toThrow(
      'Journey linear transition object at index 1 must define a finite numeric "timeoutMs" when provided.'
    );

    expect(() =>
      resolveJourneyDefinition({
        ...createJourney(),
        transitions: ["start", { step: "details", timeoutMs: Infinity }] as never
      })
    ).toThrow(
      'Journey linear transition object at index 1 must define a finite numeric "timeoutMs" when provided.'
    );
  });

  it("desugars completeJourney: true into a terminal transition", () => {
    const resolved = resolveJourneyDefinition({
      ...createJourney(),
      transitions: {
        start: { goToNextStep: [{ to: "review" }] },
        review: { completeJourney: true }
      }
    });

    expect(resolved.transitions).toContainEqual({
      from: "review",
      event: "completeJourney"
    });
  });

  it("desugars terminateJourney: [] into a terminal transition", () => {
    const resolved = resolveJourneyDefinition({
      ...createJourney(),
      transitions: {
        start: { goToNextStep: [{ to: "review" }] },
        review: { terminateJourney: [] }
      }
    });

    expect(resolved.transitions).toContainEqual({
      from: "review",
      event: "terminateJourney"
    });
  });

  it("desugars completeJourney: [] in global transitions", () => {
    const resolved = resolveJourneyDefinition({
      ...createJourney(),
      transitions: {
        global: { completeJourney: true }
      }
    });

    expect(resolved.transitions).toContainEqual({
      from: "*",
      event: "completeJourney"
    });
  });

  it("resolves step branches before global branches", () => {
    const resolved = resolveJourneyDefinition({
      ...createJourney(),
      transitions: {
        start: { submit: [{ to: "details" }] },
        global: { submit: [{ to: "review" }] }
      }
    });

    expect(resolved.transitions[0]).toMatchObject({
      from: "start",
      event: "submit",
      to: "details"
    });
    expect(resolved.transitions[1]).toMatchObject({
      from: "*",
      event: "submit",
      to: "review"
    });
  });

  it("rejects invalid transition graph definitions", () => {
    expect(() =>
      resolveJourneyDefinition({
        ...createJourney(),
        transitions: 7 as never
      })
    ).toThrow("Journey transitions must be an array or an object map when provided.");

    expect(() =>
      resolveJourneyDefinition({
        ...createJourney(),
        transitions: {
          start: [] as unknown as never
        }
      })
    ).toThrow('Journey transitions for "start" must be an event map object.');
  });
});
