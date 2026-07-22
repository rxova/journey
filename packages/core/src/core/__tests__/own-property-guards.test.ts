import { describe, expect, it } from "vitest";
import { createGraphJourney, createLinearJourney } from "@rxova/journey-core";
import { flush, startedLinear } from "@rxova/journey-core/testing";
import type { JourneyStorage } from "@rxova/journey-core/persistence";

/**
 * Every "is this a declared step?" guard once used `in`, which walks the
 * prototype chain — so these ids passed validation on any object literal and
 * produced machines parked on steps that do not exist. Two of the affected
 * guards sit on input the developer does not author: a persisted record and a
 * `goToStepById` target (routinely a route parameter).
 */
const PROTOTYPE_KEYS = [
  "toString",
  "valueOf",
  "constructor",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString"
] as const;

const KEY = "journey";

function memoryStorage(seed?: string): JourneyStorage {
  const data = new Map<string, string>();
  if (seed !== undefined) data.set(KEY, seed);
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key)
  };
}

describe("step-id guards reject inherited properties", () => {
  describe.each(PROTOTYPE_KEYS)("%s", (key) => {
    it("is rejected as a linear startAt", () => {
      expect(() =>
        createLinearJourney({ steps: ["a", "b"], context: {} }, { startAt: key as "a" })
      ).toThrow(/startAt references unknown step/);
    });

    it("is rejected as a graph startAt", () => {
      expect(() =>
        createGraphJourney(
          {
            steps: { a: {}, b: {} },
            initial: "a",
            context: {},
            transitions: { GO: { from: "a", to: "b" } }
          },
          { startAt: key as "a" }
        )
      ).toThrow(/startAt references unknown step/);
    });

    it("is rejected as a goToStepById target", async () => {
      const machine = await startedLinear();

      const result = await machine.navigate.goToStepById(key as "a");

      expect(result).toEqual({ ok: false, reason: "invalid-target" });
      const snapshot = machine.getSnapshot();
      expect(snapshot.currentStep?.id).toBe("a");
      expect(snapshot.currentStep?.index).toBe(0);
      expect(snapshot.history.timeline).toEqual(["a"]);
    });

    it("is rejected by registerNextStepInterceptor", async () => {
      const machine = await startedLinear();

      expect(() =>
        machine.navigate.registerNextStepInterceptor(key as "a", { run: () => undefined })
      ).toThrow(/references unknown step/);
    });

    it("is rejected in a persisted timeline, leaving a fresh start", async () => {
      const storage = memoryStorage(
        JSON.stringify({
          status: "running",
          context: { n: 9 },
          timeline: ["a", key],
          currentIndex: 1,
          savedAt: 1
        })
      );

      const machine = createLinearJourney(
        { steps: ["a", "b"], context: { n: 0 } },
        { persist: { key: KEY, storage } }
      );
      machine.controls.start();
      await flush();

      const snapshot = machine.getSnapshot();
      expect(snapshot.currentStep?.id).toBe("a");
      expect(snapshot.currentStep?.index).toBe(0);
      expect(snapshot.history.timeline).toEqual(["a"]);
      expect(snapshot.context).toEqual({ n: 0 });
    });
  });

  it("does not report a false duplicate for a plugin named after a prototype key", () => {
    expect(() =>
      createLinearJourney(
        { steps: ["a"], context: {} },
        { plugins: [{ name: "constructor", setup: () => ({ api: { ok: true } }) }] as const }
      )
    ).not.toThrow();
  });

  it("still rejects a genuinely duplicated plugin name", () => {
    const plugin = { name: "dup", setup: () => ({ api: {} }) };

    expect(() =>
      createLinearJourney({ steps: ["a"], context: {} }, { plugins: [plugin, plugin] as const })
    ).toThrow(/duplicate plugin name "dup"/);
  });
});

describe("a step legitimately named after a prototype key still works", () => {
  it("is navigable and keeps correct order-derived fields", async () => {
    const machine = createLinearJourney({ steps: ["a", "toString", "c"], context: {} });
    machine.controls.start();
    await flush();

    const result = await machine.navigate.goToStepById("toString");

    expect(result).toEqual({ ok: true, from: "a", to: "toString" });
    const snapshot = machine.getSnapshot();
    expect(snapshot.currentStep?.id).toBe("toString");
    // The phantom-step bug produced index -1 here, which made goToNextStep
    // rewind to the first step instead of advancing.
    expect(snapshot.currentStep?.index).toBe(1);
    expect(snapshot.currentStep?.isFirstStep).toBe(false);
    expect(snapshot.currentStep?.isLastStep).toBe(false);

    await machine.navigate.goToNextStep();
    expect(machine.getSnapshot().currentStep?.id).toBe("c");
  });

  it("is still caught when declared twice", () => {
    expect(() =>
      createLinearJourney({ steps: ["a", "toString", "toString"], context: {} })
    ).toThrow(/duplicate step id "toString"/);
  });

  it("restores from a persisted timeline that names it", async () => {
    const storage = memoryStorage(
      JSON.stringify({
        status: "running",
        context: { n: 9 },
        timeline: ["a", "toString"],
        currentIndex: 1,
        savedAt: 1
      })
    );

    const machine = createLinearJourney(
      { steps: ["a", "toString"], context: { n: 0 } },
      { persist: { key: KEY, storage } }
    );
    machine.controls.start();
    await flush();

    const snapshot = machine.getSnapshot();
    expect(snapshot.currentStep?.id).toBe("toString");
    expect(snapshot.history.timeline).toEqual(["a", "toString"]);
    expect(snapshot.context).toEqual({ n: 9 });
  });
});
