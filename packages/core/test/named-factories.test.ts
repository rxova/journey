import { describe, expect, it } from "vitest";
import {
  createLinearJourney,
  createHeadlessJourney,
  createGraphJourney,
  createGraphJourneyBuilder
} from "@rxova/journey-core";
import type {
  LinearJourneyDefinition,
  HeadlessJourneyDefinition,
  GraphJourneyDefinition
} from "@rxova/journey-core";

type SimpleContext = { value: number };

// ─── createLinearJourney ────────────────────────────────────────────────────

describe("createLinearJourney", () => {
  it("creates a machine from a string-only steps array", async () => {
    const machine = createLinearJourney<SimpleContext, "a" | "b" | "c">({
      context: { value: 0 },
      steps: ["a", "b", "c"]
    });

    await machine.startJourney();
    expect(machine.getSnapshot().currentStepId).toBe("a");
    const result = await machine.goToNextStep();
    expect(result.transitioned).toBe(true);
    expect(result.snapshot.currentStepId).toBe("b");
  });

  it("creates a machine from an object steps array with meta and lifecycle", async () => {
    const entered: string[] = [];
    const machine = createLinearJourney<SimpleContext, "one" | "two">({
      context: { value: 0 },
      steps: [
        "one",
        {
          id: "two",
          meta: { label: "Two" },
          onEnter: () => {
            entered.push("two");
          }
        }
      ]
    });

    await machine.startJourney();
    await machine.goToNextStep();
    expect(entered).toContain("two");
    expect(machine.getStepMeta("two")).toEqual({ label: "Two" });
  });

  it("goToStepByIndex(next) transitions to the next sequential step", async () => {
    const machine = createLinearJourney<SimpleContext, "x" | "y" | "z">({
      context: { value: 0 },
      steps: ["x", "y", "z"]
    });

    await machine.startJourney();
    // index 1 is the next step from index 0 → same as goToNextStep
    const result = await machine.goToStepByIndex(1);
    expect(result.transitioned).toBe(true);
    expect(result.snapshot.currentStepId).toBe("y");
  });

  it("goToStepByIndex(prev) navigates backwards", async () => {
    const machine = createLinearJourney<SimpleContext, "x" | "y" | "z">({
      context: { value: 0 },
      steps: ["x", "y", "z"]
    });

    await machine.startJourney();
    await machine.goToNextStep(); // x → y
    const result = await machine.goToStepByIndex(0); // y → x (back 1)
    expect(result.transitioned).toBe(true);
    expect(result.snapshot.currentStepId).toBe("x");
  });

  it("goToStepByIndex out of bounds returns no-op result", async () => {
    const machine = createLinearJourney<SimpleContext, "a" | "b">({
      context: { value: 0 },
      steps: ["a", "b"]
    });

    await machine.startJourney();
    const result = await machine.goToStepByIndex(99);
    expect(result.transitioned).toBe(false);
    expect(result.snapshot.currentStepId).toBe("a");
  });

  it("exposes linear computed properties", async () => {
    const machine = createLinearJourney<SimpleContext, "p" | "q" | "r">({
      context: { value: 0 },
      steps: ["p", "q", "r"]
    });

    await machine.startJourney();
    const computed = machine.getComputed();
    expect(computed.mode).toBe("linear");
    if (computed.mode === "linear") {
      expect(computed.stepCount).toBe(3);
      expect(computed.isFirstStep).toBe(true);
      expect(computed.isLastStep).toBe(false);
    }
  });

  it("accepts the LinearJourneyDefinition type", () => {
    const def: LinearJourneyDefinition<SimpleContext, "a" | "b"> = {
      context: { value: 0 },
      steps: ["a", "b"]
    };
    expect(() => createLinearJourney(def)).not.toThrow();
  });
});

// ─── createHeadlessJourney ──────────────────────────────────────────────────

describe("createHeadlessJourney", () => {
  it("creates a headless machine with initial required", async () => {
    const machine = createHeadlessJourney<SimpleContext, "start" | "end">({
      initial: "start",
      context: { value: 0 },
      steps: { start: {}, end: {} }
    });

    await machine.startJourney();
    expect(machine.getSnapshot().currentStepId).toBe("start");
    const result = await machine.goToStepById("end");
    expect(result.transitioned).toBe(true);
    expect(result.snapshot.currentStepId).toBe("end");
  });

  it("exposes headless computed mode", async () => {
    const machine = createHeadlessJourney<SimpleContext, "s1">({
      initial: "s1",
      context: { value: 0 },
      steps: { s1: {} }
    });

    await machine.startJourney();
    expect(machine.getComputed().mode).toBe("headless");
  });

  it("accepts the HeadlessJourneyDefinition type", () => {
    const def: HeadlessJourneyDefinition<SimpleContext, "a"> = {
      initial: "a",
      context: { value: 0 },
      steps: { a: {} }
    };
    expect(() => createHeadlessJourney(def)).not.toThrow();
  });
});

// ─── createGraphJourney ─────────────────────────────────────────────────────

describe("createGraphJourney", () => {
  it("creates a graph machine from builder output", async () => {
    type StepId = "login" | "dashboard";
    type Events = { type: "submit"; payload?: undefined };

    const { createStep, to, build } = createGraphJourneyBuilder<{
      context: SimpleContext;
      stepId: StepId;
      events: Events;
    }>();
    const definition = build({
      initial: "login",
      context: { value: 0 },
      steps: [
        createStep("login", { on: { submit: [to("dashboard")] } }),
        createStep("dashboard", {})
      ]
    });

    const machine = createGraphJourney(definition);
    await machine.startJourney();
    const result = await machine.send({ type: "submit" });
    expect(result.transitioned).toBe(true);
    expect(result.snapshot.currentStepId).toBe("dashboard");
  });

  it("exposes graph computed mode", async () => {
    const { createStep, build } = createGraphJourneyBuilder<{
      context: SimpleContext;
      stepId: "node";
    }>();
    const definition = build({
      initial: "node",
      context: { value: 0 },
      steps: [createStep("node", {})]
    });

    const machine = createGraphJourney(definition);
    await machine.startJourney();
    expect(machine.getComputed().mode).toBe("graph");
  });

  it("accepts the GraphJourneyDefinition type", () => {
    const def: GraphJourneyDefinition<SimpleContext, "a", never> = {
      initial: "a",
      context: { value: 0 },
      steps: { a: {} },
      transitions: {}
    };
    expect(() => createGraphJourney(def)).not.toThrow();
  });
});
