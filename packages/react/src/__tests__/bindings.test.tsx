import { describe, expect, it } from "vitest";
import { createLinearJourney } from "@rxova/journey-react";
import { createGraphJourney } from "@rxova/journey-react/graph";

/**
 * Both tiers are built from one shared bindings factory, so the surface they
 * have in common must stay literally identical — the drift this guards against
 * (a displayName on one tier only) is exactly what the shared module was
 * extracted to end, and the same parity is what a Vue or Angular wrapper would
 * be held to.
 */

const SHARED_KEYS = [
  "machine",
  "Provider",
  "StepRenderer",
  "useSnapshot",
  "useSelector",
  "useStep",
  "useContext",
  "useSubscribeEvent",
  "useMachine",
  "useControls",
  "useNavigation",
  "updateContext"
] as const;

const makeLinear = (name?: string) =>
  createLinearJourney({ ...(name === undefined ? {} : { name }), context: {}, steps: ["a", "b"] });

const makeGraph = (name?: string) =>
  createGraphJourney({
    ...(name === undefined ? {} : { name }),
    steps: { a: {}, b: {} },
    transitions: { GO: { from: "a", to: "b" } },
    initial: "a",
    context: {}
  });

describe("bundle parity", () => {
  it("exposes the whole shared surface in both tiers", () => {
    const linear = makeLinear() as unknown as Record<string, unknown>;
    const graph = makeGraph() as unknown as Record<string, unknown>;
    for (const key of SHARED_KEYS) {
      expect(linear[key], `linear is missing ${key}`).toBeDefined();
      expect(graph[key], `graph is missing ${key}`).toBeDefined();
      expect(typeof linear[key], `${key} differs in type between tiers`).toBe(typeof graph[key]);
    }
  });

  it("adds only its own tier verbs on top of the shared surface", () => {
    const linear = makeLinear();
    const graph = makeGraph();
    const extras = (bundle: object) =>
      Object.keys(bundle)
        .filter((key) => !SHARED_KEYS.includes(key as (typeof SHARED_KEYS)[number]))
        .sort();

    expect(extras(linear)).toEqual(["navigate", "useStepHandler"]);
    expect(extras(graph)).toEqual(["send"]);
  });

  it("names Provider and StepRenderer identically in both tiers", () => {
    const named = { linear: makeLinear("signup"), graph: makeGraph("checkout") };
    const displayName = (component: unknown) => (component as { displayName?: string }).displayName;

    expect(displayName(named.linear.Provider)).toBe("signup.Provider");
    expect(displayName(named.linear.StepRenderer)).toBe("signup.StepRenderer");
    expect(displayName(named.graph.Provider)).toBe("checkout.Provider");
    expect(displayName(named.graph.StepRenderer)).toBe("checkout.StepRenderer");

    // Unnamed bundles still get a tier-specific, non-empty DevTools label.
    expect(displayName(makeLinear().Provider)).toBe("LinearJourney.Provider");
    expect(displayName(makeGraph().Provider)).toBe("GraphJourney.Provider");
  });

  it("hands both tiers a machine whose commands are stable references", () => {
    for (const bundle of [makeLinear(), makeGraph()]) {
      expect(bundle.useControls).toBeTypeOf("function");
      expect(bundle.machine.controls).toBe(bundle.machine.controls);
      expect(bundle.machine.navigate).toBe(bundle.machine.navigate);
    }
  });
});
