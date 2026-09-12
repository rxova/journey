import { describe, expect, it } from "vitest";
import { withGraphTypes } from "@rxova/journey-core";
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
      candidates: [{ to: "b" }]
    }
  }
};

const definition = {
  steps: { a: aStep, b: {} },
  initial: "a" as const,
  context: { n: 0 },
  handlers,
  $payloads: {} as Payloads
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
          candidates: [{ to: "b" }]
        }
      }
    };
    expect(step.on?.GO).toBeTypeOf("object");
  });
});
