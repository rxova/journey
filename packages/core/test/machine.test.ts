import { describe, expect, it } from "vitest";

import {
  JOURNEY_STATUS,
  createJourneyMachine,
  type JourneyDefinition,
  type JourneyObservationEvent
} from "@rxova/journey-core";

type StepId = "start" | "details" | "review" | "confirmExit";
type Event = "goToNextStep" | "back" | "requestClose" | "terminateJourney" | "completeJourney";
type Context = { dirty: boolean; count: number };
type Meta = { title: string };

const createJourney = (): JourneyDefinition<
  Context,
  StepId,
  Event,
  Record<never, never>,
  Meta
> => ({
  initial: "start",
  context: { dirty: false, count: 0 },
  steps: {
    start: { meta: { title: "Start" } },
    details: { meta: { title: "Details" } },
    review: { meta: { title: "Review" } },
    confirmExit: { meta: { title: "Confirm exit" } }
  },
  transitions: [
    { id: "start-next", from: "start", event: "goToNextStep", to: "details" },
    { id: "details-next", from: "details", event: "goToNextStep", to: "review" },
    {
      id: "close-dirty",
      from: "*",
      event: "requestClose",
      to: "confirmExit",
      when: ({ context }) => context.dirty
    },
    {
      id: "close-clean",
      from: "*",
      event: "terminateJourney",
      when: ({ context }) => !context.dirty
    },
    { id: "submit-review", from: "review", event: "completeJourney" }
  ]
});

const createMachine = () =>
  createJourneyMachine<Context, StepId, Event, Record<never, never>, Meta>(createJourney());

describe("createJourneyMachine", () => {
  it("builds snapshot shape at startup", () => {
    const machine = createMachine();
    const snapshot = machine.getSnapshot();

    expect(snapshot.currentStepId).toBe("start");
    expect(snapshot.history.timeline).toEqual(["start"]);
    expect(snapshot.history.index).toBe(0);
    expect(snapshot.visited).toEqual({
      start: true,
      details: false,
      review: false,
      confirmExit: false
    });
    expect(snapshot.stepMeta.start).toEqual({ title: "Start" });
  });

  it("default back behavior works without explicit back transition", async () => {
    const machine = createMachine();

    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });

    const result = await machine.send({ type: "back" });

    expect(result.transitioned).toBe(true);
    expect(result.transitionId).toBe("back");
    expect(machine.getSnapshot().currentStepId).toBe("details");
  });

  it("goToPreviousStep with n and goToLastVisitedStep work as navigation APIs", async () => {
    const machine = createMachine();

    await machine.goToNextStep();
    await machine.goToNextStep();

    await machine.goToPreviousStep(2);
    expect(machine.getSnapshot().currentStepId).toBe("start");

    await machine.goToLastVisitedStep();
    expect(machine.getSnapshot().currentStepId).toBe("review");
  });

  it("goToNextStep convenience API behaves like send(goToNextStep)", async () => {
    const machine = createMachine();

    const result = await machine.goToNextStep();

    expect(result.transitioned).toBe(true);
    expect(result.transitionId).toBe("start-next");
    expect(machine.getSnapshot().currentStepId).toBe("details");
  });

  it("completeJourney convenience API behaves like send(completeJourney)", async () => {
    const machine = createMachine();

    await machine.goToNextStep();
    await machine.goToNextStep();
    const result = await machine.completeJourney();

    expect(result.transitioned).toBe(true);
    expect(result.transitionId).toBe("submit-review");
    expect(machine.getSnapshot().status).toBe(JOURNEY_STATUS.COMPLETE);
  });

  it("terminateJourney convenience API behaves like send(terminateJourney)", async () => {
    const machine = createMachine();

    const result = await machine.terminateJourney();

    expect(result.transitioned).toBe(true);
    expect(result.transitionId).toBe("close-clean");
    expect(machine.getSnapshot().status).toBe(JOURNEY_STATUS.TERMINATED);
  });

  it("emits transition and step lifecycle events in deterministic order", async () => {
    const machine = createMachine();
    const events: JourneyObservationEvent<StepId, Event, Record<never, never>, Meta>[] = [];

    const unsubscribe = machine.subscribeEvent((event) => {
      events.push(event);
    });

    await machine.send({ type: "goToNextStep" });
    unsubscribe();

    expect(events.map((event) => event.type)).toEqual([
      "transition.start",
      "step.exit",
      "transition.success",
      "step.enter"
    ]);
    expect(events[0]).toMatchObject({ type: "transition.start", from: "start" });
    expect(events[2]).toMatchObject({
      type: "transition.success",
      from: "start",
      to: "details",
      transitionId: "start-next"
    });
  });

  it("updates step metadata immutably and emits metadata.updated", () => {
    const machine = createMachine();
    const eventTypes: string[] = [];

    machine.subscribeEvent((event) => {
      eventTypes.push(event.type);
    });

    const before = machine.getSnapshot();
    machine.updateStepMetadata("details", (meta) => ({ ...meta, title: "Details updated" }));
    const after = machine.getSnapshot();

    expect(before.stepMeta.details).toEqual({ title: "Details" });
    expect(after.stepMeta.details).toEqual({ title: "Details updated" });
    expect(after.stepMeta.start).toEqual(before.stepMeta.start);
    expect(eventTypes).toContain("metadata.updated");
  });

  it("blocks pointer moves once terminal unless reset", async () => {
    const machine = createMachine();

    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "completeJourney" });

    expect(machine.getSnapshot().status).toBe(JOURNEY_STATUS.COMPLETE);

    const next = await machine.goToNextStep();
    const prev = await machine.goToPreviousStep();
    const last = await machine.goToLastVisitedStep();

    expect(next.transitioned).toBe(false);
    expect(prev.transitioned).toBe(false);
    expect(last.transitioned).toBe(false);

    machine.resetMachine();
    expect(machine.getSnapshot().status).toBe(JOURNEY_STATUS.RUNNING);
    expect(machine.getSnapshot().currentStepId).toBe("start");
  });
});
