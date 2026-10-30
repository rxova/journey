import { describe, expect, it } from "vitest";
import { compileGraph, createGraphJourney, withGraphTypes } from "@rxova/journey-core";
import type { GraphStep } from "@rxova/journey-core";
import { flush } from "@rxova/journey-core/testing";

/**
 * Type-surface regressions, asserted with `@ts-expect-error` — these fail the
 * package typecheck, not the runtime assertions. Each covers a defect that
 * would have needed a major release to correct once 1.0 froze the types.
 */

type Handlers = { readonly api: { readonly load: () => Promise<string> } };
type Payloads = {
  readonly complete: { readonly receipt: string };
  readonly terminate: "cancelled";
};

const handlers: Handlers = { api: { load: () => Promise.resolve("ok") } };

type AuthBag = {
  context: { n: number };
  stepId: "a" | "b";
  events: { type: "GO" };
  handlers: Handlers;
};

let loaded: string | null = null;

const aStep: GraphStep<AuthBag> = {
  on: {
    GO: {
      run: async ({ handlers: h }) => {
        // Would be `unknown` before THandlers was threaded through the bag.
        const api: Handlers["api"] = h.api;
        loaded = await api.load();
      },
      candidates: [{ to: "b" }],
    },
  },
};

const definition = {
  steps: { a: aStep, b: {} },
  initial: "a" as const,
  context: { n: 0 },
  handlers,
  $payloads: {} as Payloads,
};

describe("declared work receives typed handlers", () => {
  it("resolves the declared handler type rather than unknown", async () => {
    loaded = null;
    const machine = withGraphTypes<AuthBag>()(definition);
    machine.controls.start();
    await flush();

    await machine.send("GO");

    expect(loaded).toBe("ok");
    expect(machine.getSnapshot().currentStep?.id).toBe("b");
  });

  it("rejects a mistyped handler read", () => {
    const step: GraphStep<AuthBag> = {
      on: {
        GO: {
          run: ({ handlers: h }) => {
            // @ts-expect-error `missing` is not a declared handler
            void h.missing;
          },
          candidates: [{ to: "b" }],
        },
      },
    };
    expect(step.on?.GO).toBeTypeOf("object");
  });
});

/**
 * `createGraphJourney` takes a union of the definition literal and a compiled
 * graph. A union parameter is inference-fragile: if the compiled arm were
 * reachable for a plain literal, `TStepId` would widen to `string` and every
 * id check below would silently start passing. Each `@ts-expect-error` here
 * fails the typecheck the moment that happens.
 */
describe("the compiled-graph union leaves step id inference intact", () => {
  const literal = {
    initial: "a",
    context: { n: 0 },
    steps: { a: { on: { GO: "b" } }, b: {} },
  } as const;

  it("narrows goToStepById from a plain literal", () => {
    const machine = createGraphJourney(literal, { autoStart: false });
    // @ts-expect-error "zzz" is not a declared step id
    void machine.navigate.goToStepById("zzz");
    expect(machine.getSnapshot().currentStep).toBeNull();
  });

  it("narrows goToStepById from a compiled graph", () => {
    const machine = createGraphJourney(compileGraph(literal), { autoStart: false });
    // @ts-expect-error "zzz" is not a declared step id
    void machine.navigate.goToStepById("zzz");
    expect(machine.getSnapshot().currentStep).toBeNull();
  });

  it("narrows goToStepById from a spread compiled graph", () => {
    const machine = createGraphJourney({ ...compileGraph(literal) }, { autoStart: false });
    // @ts-expect-error "zzz" is not a declared step id
    void machine.navigate.goToStepById("zzz");
    expect(machine.getSnapshot().currentStep).toBeNull();
  });

  it("still rejects an initial that is not a declared step", () => {
    expect(() =>
      createGraphJourney({
        // @ts-expect-error "zzz" is not a declared step id
        initial: "zzz",
        context: { n: 0 },
        steps: { a: {}, b: {} },
      }),
    ).toThrow();
  });
});
