import { describe, expect, it } from "vitest";
import { analyzeStructure, createGraphJourney } from "@rxova/journey-core";
import type { JourneyPlugin, JourneyStructure } from "@rxova/journey-core";
import { flush } from "@rxova/journey-core/testing";

const readStructure = (): { probe: JourneyPlugin; get: () => JourneyStructure } => {
  let seen: JourneyStructure | null = null;
  return {
    probe: {
      name: "probe",
      setup: (host) => {
        seen = host.structure;
        return {};
      },
    },
    get: () => seen as unknown as JourneyStructure,
  };
};

describe("edgeMeta", () => {
  it("is absent from the structure view when no edge declares it", () => {
    const { probe, get } = readStructure();
    createGraphJourney(
      {
        initial: "a",
        context: {},
        steps: { a: { on: { go: "b" } }, b: {} },
      },
      { autoStart: false, plugins: [probe] as const },
    );

    const [edge] = get().transitions;
    expect(Object.keys(edge as object).sort()).toEqual([
      "event",
      "from",
      "guarded",
      "index",
      "label",
      "to",
    ]);
    expect(edge).not.toHaveProperty("edgeMeta");
  });

  it("carries a declared edgeMeta into the structure view, per edge", () => {
    const { probe, get } = readStructure();
    createGraphJourney(
      {
        initial: "a",
        context: {},
        steps: {
          a: {
            on: {
              call: [
                { to: "b", edgeMeta: { transport: "http" } },
                { to: "c", edgeMeta: { transport: "kafka" }, when: () => false },
              ],
            },
          },
          b: { on: { plain: "c" } },
          c: {},
        },
      },
      { autoStart: false, plugins: [probe] as const },
    );

    const edges = get().transitions;
    expect(edges[0]?.edgeMeta).toEqual({ transport: "http" });
    expect(edges[1]?.edgeMeta).toEqual({ transport: "kafka" });
    // The undeclared edge keeps the shape it always had.
    expect(edges[2]).not.toHaveProperty("edgeMeta");
  });

  it("does not affect routing", async () => {
    const machine = createGraphJourney({
      initial: "a",
      context: {},
      steps: {
        a: { on: { go: [{ to: "b", edgeMeta: { weight: 10 } }] } },
        b: {},
      },
    });

    await flush();
    expect(await machine.send("go")).toMatchObject({ ok: true });
    expect(machine.getSnapshot().currentStep?.id).toBe("b");
  });

  it("leaves analyzeStructure results unchanged", () => {
    const withMeta = {
      initial: "a",
      steps: {
        a: { on: { go: [{ to: "b", edgeMeta: { transport: "http" } }] } },
        b: { on: { back: "a" } },
      },
    };
    const without = {
      initial: "a",
      steps: { a: { on: { go: [{ to: "b" }] } }, b: { on: { back: "a" } } },
    };

    expect(analyzeStructure(withMeta)).toEqual(analyzeStructure(without));
  });
});

describe("stepMeta", () => {
  it("reaches currentStep under its new name", async () => {
    const machine = createGraphJourney({
      initial: "a",
      context: {},
      steps: { a: { stepMeta: { title: "Start" }, on: { go: "b" } }, b: {} },
    });

    await flush();
    expect(machine.getSnapshot().currentStep?.stepMeta).toEqual({ title: "Start" });
  });

  it("defaults to an empty object when a step declares none", async () => {
    const machine = createGraphJourney({
      initial: "a",
      context: {},
      steps: { a: {}, b: {} },
    });

    await flush();
    expect(machine.getSnapshot().currentStep?.stepMeta).toEqual({});
  });
});

describe("structure.steps", () => {
  it("carries declared stepMeta, and an empty object where none was declared", () => {
    const { probe, get } = readStructure();
    createGraphJourney(
      {
        initial: "a",
        context: {},
        steps: { a: { stepMeta: { owner: "auth" }, on: { go: "b" } }, b: {} },
      },
      { autoStart: false, plugins: [probe] as const },
    );

    const { steps } = get();
    expect(Object.keys(steps)).toEqual(["a", "b"]);
    expect(steps["a"]?.stepMeta).toEqual({ owner: "auth" });
    expect(steps["b"]?.stepMeta).toEqual({});
    expect(Object.isFrozen(steps)).toBe(true);
  });
});
