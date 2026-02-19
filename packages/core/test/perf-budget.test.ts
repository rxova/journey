import { describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";

import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "s0" | "s1" | "s2" | "s3" | "s4";
type Event = "goToNextStep";
type Context = { count: number };

const createLinearJourney = (): JourneyDefinition<Context, StepId, Event> => ({
  initial: "s0",
  context: { count: 0 },
  steps: {
    s0: {},
    s1: {},
    s2: {},
    s3: {},
    s4: {}
  },
  transitions: [
    { from: "s0", event: "goToNextStep", to: "s1" },
    { from: "s1", event: "goToNextStep", to: "s2" },
    { from: "s2", event: "goToNextStep", to: "s3" },
    { from: "s3", event: "goToNextStep", to: "s4" },
    { from: "s4", event: "goToNextStep", to: "s0" }
  ]
});

describe("performance budget", () => {
  it("evaluates transitions within the budget", async () => {
    const machine = createJourneyMachine(createLinearJourney());
    const iterations = 2000;
    const budgetMs = 1000;

    for (let i = 0; i < 200; i += 1) {
      await machine.send({ type: "goToNextStep" });
    }

    const start = performance.now();
    for (let i = 0; i < iterations; i += 1) {
      await machine.send({ type: "goToNextStep" });
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(budgetMs);
  });
});
