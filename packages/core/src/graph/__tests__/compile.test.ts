import { describe, expect, it } from "vitest";
import {
  analyzeStructure,
  compileGraph,
  createGraphJourney,
  isJourneyError,
} from "@rxova/journey-core";
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

const definition = {
  initial: "a",
  context: { n: 0 },
  steps: {
    a: { stepMeta: { owner: "auth" }, on: { go: [{ to: "b", edgeMeta: { transport: "http" } }] } },
    b: { on: { back: "a" } },
  },
} as const;

// The invalid definitions below are rejected by the types too, which is the
// point of the type-surface test — compile them through the erased parameter
// so this file can assert what happens at runtime.
const codeOf = (invalid: unknown): string => {
  try {
    compileGraph(invalid as Parameters<typeof compileGraph>[0]);
  } catch (error) {
    return isJourneyError(error) ? error.code : `not-a-journey-error:${String(error)}`;
  }
  return "no-throw";
};

describe("compileGraph", () => {
  it("produces the structure a plugin sees, frozen", () => {
    const { probe, get } = readStructure();
    createGraphJourney(definition, { autoStart: false, plugins: [probe] as const });

    const compiled = compileGraph(definition);
    expect(compiled.structure).toEqual(get());
    expect(Object.isFrozen(compiled)).toBe(true);
    expect(Object.isFrozen(compiled.structure)).toBe(true);
  });

  it("carries declared stepMeta on the structure, and an empty object where none was declared", () => {
    const { steps } = compileGraph(definition).structure;

    expect(steps["a"]?.stepMeta).toEqual({ owner: "auth" });
    expect(steps["b"]?.stepMeta).toEqual({});
  });

  it("keeps the runtime payload off every public view of the object", () => {
    const compiled = compileGraph(definition);

    expect(Object.keys(compiled)).toEqual(["structure"]);
    expect(JSON.parse(JSON.stringify(compiled))).toEqual({ structure: compiled.structure });
  });

  it("drives createGraphJourney exactly like the plain literal, before and after a spread", async () => {
    const compiled = compileGraph(definition);
    const machines = [
      createGraphJourney(definition),
      createGraphJourney(compiled),
      createGraphJourney({ ...compiled }),
    ];
    await flush();

    for (const machine of machines) {
      expect(machine.getSnapshot().currentStep?.id).toBe("a");
      expect(machine.getSnapshot().currentStep?.stepMeta).toEqual({ owner: "auth" });
      expect(await machine.send("go")).toMatchObject({ ok: true });
      expect(machine.getSnapshot().currentStep?.id).toBe("b");
    }
  });

  it("analyzes the same as the definition it came from", () => {
    expect(analyzeStructure(compileGraph(definition))).toEqual(analyzeStructure(definition));
  });

  it("rejects a definition with no steps", () => {
    expect(codeOf({ initial: "a", context: {}, steps: {} })).toBe("empty-definition");
  });

  it("rejects an initial step that was never declared", () => {
    expect(codeOf({ initial: "zzz", context: {}, steps: { a: {} } })).toBe("unknown-initial-step");
  });

  it("rejects a transition pointing at an undeclared step", () => {
    expect(codeOf({ initial: "a", context: {}, steps: { a: { on: { go: "zzz" } } } })).toBe(
      "dangling-transition",
    );
  });

  it("rejects an empty label on a candidate and on declared work", () => {
    expect(
      codeOf({ initial: "a", context: {}, steps: { a: { on: { go: [{ to: "a", label: "" }] } } } }),
    ).toBe("invalid-label");

    expect(
      codeOf({
        initial: "a",
        context: {},
        steps: {
          a: { on: { go: { run: () => undefined, label: "", candidates: [{ to: "a" }] } } },
        },
      }),
    ).toBe("invalid-label");
  });

  it("rejects a non-positive timeout on a candidate and on declared work", () => {
    expect(
      codeOf({
        initial: "a",
        context: {},
        steps: { a: { on: { go: [{ to: "a", timeoutMs: 0 }] } } },
      }),
    ).toBe("invalid-timeout");

    expect(
      codeOf({
        initial: "a",
        context: {},
        steps: {
          a: { on: { go: { run: () => undefined, timeoutMs: -1, candidates: [{ to: "a" }] } } },
        },
      }),
    ).toBe("invalid-timeout");
  });
});

describe("a compiled graph resists tampering", () => {
  const definition = {
    initial: "a",
    context: {},
    steps: { a: { stepMeta: { team: "x" }, on: { go: "b" } }, b: {} },
  } as const;

  it("freezes the step views a plugin reads, not just the map holding them", () => {
    const { structure } = compileGraph(definition);

    expect(Object.isFrozen(structure.steps)).toBe(true);
    expect(Object.isFrozen(structure.steps.a)).toBe(true);
    // A plugin that tries to hijack the view for every later plugin fails.
    expect(() => {
      (structure.steps.a as { stepMeta: unknown }).stepMeta = { team: "hijacked" };
    }).toThrow();
    expect(structure.steps.a?.stepMeta).toEqual({ team: "x" });
  });

  it("freezes the runtime payload, so one machine cannot inject a hook into the next", () => {
    const compiled = compileGraph(definition);
    const payload = Object.getOwnPropertySymbols(compiled)
      .map((symbol) => (compiled as unknown as Record<symbol, unknown>)[symbol])
      .find((value): value is { steps: Record<string, object> } => typeof value === "object");

    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload?.steps)).toBe(true);
    expect(Object.isFrozen(payload?.steps.a)).toBe(true);
  });

  it("rejects a forged payload instead of routing onto an undeclared step", () => {
    const compiled = compileGraph(definition);
    const [marker] = Object.getOwnPropertySymbols(compiled);
    const forged = {
      structure: compiled.structure,
      [marker as symbol]: {
        stepIds: ["a"],
        steps: { a: {} },
        transitions: [{ event: "go", from: "a", to: "nowhere", index: 0 }],
        eventWork: {},
        initial: "a",
        context: {},
      },
    };

    expect(() => createGraphJourney(forged as never)).toThrow(/compiled graph payload is unusable/);
  });

  it("does not let a __proto__ step id become a prototype write", () => {
    const compiled = compileGraph({
      initial: "a",
      context: {},
      steps: { a: { on: { go: "b" } }, b: {}, ["__proto__" as string]: {} },
    } as never);

    expect(compiled.structure.stepIds).toContain("__proto__");
    expect(({} as Record<string, unknown>).go).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty("on");
  });
});
