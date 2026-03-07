import { describe, expect, it } from "vitest";

import { createJourneyMachine, createTransitions, tx } from "@rxova/journey-core";
import type { JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "details" | "extra" | "review" | "confirmExit";
type Event = "goToNextStep" | "requestClose" | "terminateJourney";
type Context = { includeDetails: boolean; dirty: boolean };

const createJourney = (): JourneyDefinition<Context, StepId, Event> => ({
  initial: "start",
  context: { includeDetails: false, dirty: false },
  steps: {
    start: {},
    details: {},
    extra: {},
    review: {},
    confirmExit: {}
  },
  transitions: [
    { id: "start-next", from: "start", event: "goToNextStep", to: "details" },
    {
      id: "details-next-extra",
      from: "details",
      event: "goToNextStep",
      to: "extra",
      when: ({ context }) => context.includeDetails
    },
    {
      id: "details-next-review",
      from: "details",
      event: "goToNextStep",
      to: "review",
      when: ({ context }) => !context.includeDetails
    },
    { id: "extra-next-review", from: "extra", event: "goToNextStep", to: "review" },
    {
      id: "close-dirty",
      from: "*",
      event: "requestClose",
      to: "confirmExit",
      when: ({ context }) => context.dirty
    },
    { id: "close-clean", from: "*", event: "terminateJourney" }
  ]
});

describe("flow behavior", () => {
  it("tx + createTransitions flatten branch declarations", () => {
    const startNext = tx.from<StepId, Context>("start").on("goToNextStep");

    const transitions = createTransitions<Context, StepId, Event, Record<never, never>>(
      startNext.to("start", { id: "start-next" }),
      tx.any<Context, StepId>().on("requestClose").to("confirmExit", { id: "wildcard-close" }),
      startNext.choose(
        startNext.when(() => true).to("start", { id: "branch-1" }),
        startNext.otherwise().to("start", { id: "branch-2" })
      )
    );

    expect(transitions).toHaveLength(4);
    expect(transitions.map((transition) => transition.id)).toEqual([
      "start-next",
      "wildcard-close",
      "branch-1",
      "branch-2"
    ]);
    expect(transitions[1]?.from).toBe("*");
  });

  it("supports branch-like behavior via first-match transitions", async () => {
    const machine = createJourneyMachine(createJourney());

    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });

    expect(machine.getSnapshot().currentStepId).toBe("review");

    machine.resetMachine();
    machine.updateContext((context) => ({ ...context, includeDetails: true }));

    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });

    expect(machine.getSnapshot().currentStepId).toBe("extra");
  });

  it("preserves first-match-wins semantics", async () => {
    const journey = createJourney();
    journey.transitions = [
      {
        id: "early",
        from: "start",
        event: "goToNextStep",
        to: "review"
      },
      ...journey.transitions
    ];

    const machine = createJourneyMachine(journey);
    const result = await machine.send({ type: "goToNextStep" });

    expect(result.transitioned).toBe(true);
    expect(result.transitionId).toBe("early");
    expect(machine.getSnapshot().currentStepId).toBe("review");
  });

  it("supports wildcard close transitions", async () => {
    const machine = createJourneyMachine(createJourney());

    machine.updateContext((context) => ({ ...context, dirty: true }));
    await machine.send({ type: "requestClose" });

    expect(machine.getSnapshot().currentStepId).toBe("confirmExit");
  });
});
