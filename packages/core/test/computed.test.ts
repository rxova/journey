import { describe, expect, it } from "vitest";

import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";
import { createJourneyMachineComputedGetter } from "../src/journey-machine/computed";
import { buildInitialAsyncState } from "../src/journey-machine/helpers";
import { resolveJourneyDefinition } from "../src/journey-machine/resolve-journey-definition";

type LinearStepId = "start" | "details" | "review";
type GraphStepId = "start" | "details" | "review" | "confirmExit";
type HeadlessStepId = "start" | "review";

describe("journey computed state", () => {
  it("derives wizard-style state for linear transitions", async () => {
    const journey: JourneyDefinition<{ submitted: boolean }, LinearStepId> = {
      context: { submitted: false },
      steps: {
        start: {},
        details: {},
        review: {}
      },
      transitions: [
        "start",
        {
          step: "details",
          label: "start-next"
        },
        "review"
      ]
    };
    const machine = createJourneyMachine(journey);

    expect(machine.getComputed()).toEqual({
      mode: "linear",
      activeStepId: "start",
      activeStepIndex: 0,
      visitedStepCount: 1,
      isLoading: false,
      isIdle: true,
      isRunning: false,
      isComplete: false,
      isTerminated: false,
      isInitialStep: true,
      stepCount: 3,
      journeyLength: 3,
      isFirstStep: true,
      isLastStep: false,
      stepOrder: ["start", "details", "review"]
    });

    await machine.startJourney();
    expect(machine.getComputed().isRunning).toBe(true);

    await machine.goToNextStep();

    expect(machine.getComputed()).toMatchObject({
      mode: "linear",
      activeStepId: "details",
      activeStepIndex: 1,
      visitedStepCount: 2,
      isInitialStep: false,
      isFirstStep: false,
      isLastStep: false
    });

    await machine.goToNextStep();

    expect(machine.getComputed()).toMatchObject({
      mode: "linear",
      activeStepId: "review",
      activeStepIndex: 2,
      visitedStepCount: 3,
      isFirstStep: false,
      isLastStep: true
    });

    await machine.goToNextStep();

    expect(machine.getComputed()).toMatchObject({
      mode: "linear",
      activeStepId: "review",
      activeStepIndex: 2,
      isComplete: true,
      isLastStep: true
    });
  });

  it("reports correct linear progress after goToStepById skips a step", async () => {
    const journey: JourneyDefinition<{ submitted: boolean }, LinearStepId> = {
      context: { submitted: false },
      steps: {
        start: {},
        details: {},
        review: {}
      },
      transitions: ["start", "details", "review"]
    };
    const machine = createJourneyMachine(journey);
    await machine.startJourney();

    await machine.goToNextStep(); // start → details
    await machine.goToNextStep(); // details → review

    expect(machine.getComputed()).toMatchObject({
      mode: "linear",
      activeStepId: "review",
      activeStepIndex: 2,
      isFirstStep: false,
      isLastStep: true
    });
  });

  it("reports isFirstStep=false and isLastStep=false for a middle linear step", async () => {
    const journey: JourneyDefinition<Record<string, never>, LinearStepId> = {
      context: {},
      steps: {
        start: {},
        details: {},
        review: {}
      },
      transitions: ["start", "details", "review"]
    };
    const machine = createJourneyMachine(journey);
    await machine.startJourney();

    await machine.goToNextStep(); // start → details

    const computed = machine.getComputed();
    expect(computed).toMatchObject({
      mode: "linear",
      activeStepId: "details",
      isFirstStep: false,
      isLastStep: false
    });
  });

  it("exposes structural progress for graph transitions without wizard-only fields", async () => {
    const journey: JourneyDefinition<{ includeDetails: boolean }, GraphStepId> = {
      initial: "start",
      context: { includeDetails: true },
      steps: {
        start: {},
        details: {},
        review: {},
        confirmExit: {}
      },
      transitions: {
        start: {
          goToNextStep: [
            {
              to: "details",
              when: ({ context }) => context.includeDetails
            },
            {
              to: "review",
              when: ({ context }) => !context.includeDetails
            }
          ],
          goToStepById: [{ to: "review" }]
        },
        details: {
          goToNextStep: [{ to: "review" }]
        },
        global: {
          terminateJourney: [{}]
        }
      }
    };
    const machine = createJourneyMachine(journey);

    expect(machine.getComputed()).toEqual({
      mode: "graph",
      activeStepId: "start",
      activeStepIndex: 0,
      visitedStepCount: 1,
      isLoading: false,
      isIdle: true,
      isRunning: false,
      isComplete: false,
      isTerminated: false,
      isInitialStep: true
    });

    await machine.startJourney();
    await machine.send({ type: "goToStepById", stepId: "review" });

    expect(machine.getComputed()).toEqual({
      mode: "graph",
      activeStepId: "review",
      activeStepIndex: 1,
      visitedStepCount: 2,
      isLoading: false,
      isIdle: false,
      isRunning: true,
      isComplete: false,
      isTerminated: false,
      isInitialStep: false
    });
  });

  it("stays available in headless mode", async () => {
    const journey: JourneyDefinition<Record<string, never>, HeadlessStepId> = {
      initial: "start",
      context: {},
      steps: {
        start: {},
        review: {}
      }
    };
    const machine = createJourneyMachine(journey);

    expect(machine.getComputed()).toEqual({
      mode: "headless",
      activeStepId: "start",
      activeStepIndex: 0,
      visitedStepCount: 1,
      isLoading: false,
      isIdle: true,
      isRunning: false,
      isComplete: false,
      isTerminated: false,
      isInitialStep: true
    });

    await machine.startJourney();
    expect(machine.getComputed().isRunning).toBe(true);
    expect(machine.getComputed().isInitialStep).toBe(true);
  });

  it("falls back to the history index when the active step is outside the linear order", () => {
    const journey = {
      context: {},
      steps: {
        start: {},
        details: {},
        detached: {}
      },
      transitions: ["start", "details"] as const
    } satisfies JourneyDefinition<Record<string, never>, "start" | "details" | "detached">;

    const getComputed = createJourneyMachineComputedGetter(
      journey,
      resolveJourneyDefinition(
        journey as JourneyDefinition<Record<string, never>, "start" | "details">
      ) as never,
      () => ({
        currentStepId: "detached",
        history: {
          timeline: ["start", "detached"],
          index: 1
        },
        context: {},
        visited: {
          start: true,
          details: false,
          detached: false
        },
        status: "running",
        async: buildInitialAsyncState(journey.steps)
      })
    );

    expect(getComputed()).toEqual({
      mode: "linear",
      activeStepId: "detached",
      activeStepIndex: 1,
      visitedStepCount: 1,
      isLoading: false,
      isIdle: false,
      isRunning: true,
      isComplete: false,
      isTerminated: false,
      isInitialStep: false,
      stepCount: 2,
      journeyLength: 2,
      isFirstStep: false,
      isLastStep: false,
      stepOrder: ["start", "details"]
    });
  });
});
