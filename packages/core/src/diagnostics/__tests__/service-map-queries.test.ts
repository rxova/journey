import { describe, expect, it } from "vitest";
import { compileGraph } from "@rxova/journey-core";
import type { JourneyStructure } from "@rxova/journey-core";

/**
 * The service-map case end to end: model how repos depend on each other, then
 * answer the three questions that matter — what breaks if this breaks, who
 * depends on this, and are there dependency cycles.
 *
 * Every query here is a plain function over the public `structure`. The library
 * needs no plugin and no new query API to support them; it only has to hand
 * over an inert graph, which `compileGraph` does.
 */

type Edge = JourneyStructure["transitions"][number];

const adjacency = (structure: JourneyStructure, reverse: boolean, keep?: (e: Edge) => boolean) => {
  const out = new Map<string, string[]>();
  for (const edge of structure.transitions) {
    if (keep && !keep(edge)) continue;
    const [key, next] = reverse ? [edge.to, edge.from] : [edge.from, edge.to];
    const list = out.get(key);
    if (list) list.push(next);
    else out.set(key, [next]);
  }
  return out;
};

/** Breadth-first walk with distances and a parent map that explains each hop. */
const reach = (
  structure: JourneyStructure,
  options: { from: string; reverse?: boolean; keep?: (e: Edge) => boolean },
) => {
  const next = adjacency(structure, options.reverse ?? false, options.keep);
  const depth: Record<string, number> = { [options.from]: 0 };
  const via: Record<string, string> = {};
  const order = [options.from];
  for (let i = 0; i < order.length; i += 1) {
    const id = order[i] as string;
    for (const target of next.get(id) ?? []) {
      if (depth[target] !== undefined) continue;
      depth[target] = (depth[id] as number) + 1;
      via[target] = id;
      order.push(target);
    }
  }
  return { steps: order, depth, via };
};

const serviceMap = compileGraph({
  initial: "web",
  context: {},
  steps: {
    web: {
      stepMeta: { team: "frontend" },
      on: {
        "dep:api": [{ to: "api", edgeMeta: { transport: "http" } }],
        "dep:cdn": [{ to: "cdn", edgeMeta: { transport: "http", external: true } }],
      },
    },
    api: {
      stepMeta: { team: "platform" },
      on: {
        "dep:auth": [{ to: "auth", edgeMeta: { transport: "grpc" } }],
        "dep:billing": [{ to: "billing", edgeMeta: { transport: "kafka" } }],
      },
    },
    auth: { stepMeta: { team: "platform" }, on: { "dep:db": [{ to: "db" }] } },
    billing: { stepMeta: { team: "payments" }, on: { "dep:db": [{ to: "db" }] } },
    db: { stepMeta: { team: "platform" } },
    cdn: { stepMeta: { team: "vendor", external: true } },
  },
});

describe("service-map queries over a compiled graph", () => {
  it("answers blast radius: what breaks if this repo breaks", () => {
    const { steps, depth } = reach(serviceMap.structure, { from: "api" });

    expect(steps).toEqual(["api", "auth", "billing", "db"]);
    expect(depth).toEqual({ api: 0, auth: 1, billing: 1, db: 2 });
  });

  it("answers upstream: who depends on this repo, and by what path", () => {
    const { steps, via } = reach(serviceMap.structure, { from: "db", reverse: true });

    expect(new Set(steps)).toEqual(new Set(["db", "auth", "billing", "api", "web"]));
    // `via` explains the hop, which is what a UI shows when asked "why?"
    expect(via.api).toMatch(/auth|billing/);
    expect(via.web).toBe("api");
  });

  it("narrows to a subgraph using edgeMeta, without rebuilding the definition", () => {
    const { steps } = reach(serviceMap.structure, {
      from: "web",
      keep: (edge) => edge.edgeMeta?.transport === "http",
    });

    expect(steps).toEqual(["web", "api", "cdn"]);
  });

  it("reads step data off the structure, so a query can tell vendors apart", () => {
    const external = Object.entries(serviceMap.structure.steps)
      .filter(([, step]) => (step.stepMeta as { external?: boolean }).external === true)
      .map(([id]) => id);

    expect(external).toEqual(["cdn"]);
  });

  it("needs no machine: the compiled graph is inert and serializable", () => {
    expect(Object.isFrozen(serviceMap.structure)).toBe(true);
    expect(Object.keys(serviceMap)).toEqual(["structure"]);
    expect(() => JSON.stringify(serviceMap.structure)).not.toThrow();
  });
});
