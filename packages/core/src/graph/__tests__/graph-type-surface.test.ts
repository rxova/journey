import { describe, expect, it } from "vitest";
import { createGraphJourney, createLinearJourney } from "@rxova/journey-core";
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

const definition = {
  steps: { a: {}, b: {} },
  initial: "a" as const,
  context: { n: 0 },
  handlers,
  transitions: { GO: { from: "a" as const, to: "b" as const } },
  $payloads: {} as Payloads
};

describe("graph send work receives typed handlers", () => {
  it("resolves the declared handler type rather than unknown", async () => {
    const machine = createGraphJourney(definition);
    machine.controls.start();
    await flush();

    let loaded: string | null = null;
    await machine.send("GO", undefined, {
      run: async (args) => {
        // Would be `unknown` before THandlers was threaded into the return type.
        const api: Handlers["api"] = args.handlers.api;
        loaded = await api.load();
      }
    });

    expect(loaded).toBe("ok");
    expect(machine.getSnapshot().currentStep?.id).toBe("b");
  });

  it("rejects a mistyped handler read", async () => {
    const machine = createGraphJourney(definition);
    machine.controls.start();
    await flush();

    await machine.send("GO", undefined, {
      run: (args) => {
        // @ts-expect-error `missing` is not a declared handler
        void args.handlers.missing;
      }
    });

    expect(machine.getSnapshot().currentStep?.id).toBe("b");
  });
});

describe("graph completion and termination payloads are typed", () => {
  it("accepts the declared payloads and exposes them on the outcome", async () => {
    const machine = createGraphJourney(definition);
    machine.controls.start();
    await flush();

    machine.controls.complete({ receipt: "r-1" });

    const outcome = machine.getSnapshot().machine.outcome;
    expect(outcome).toEqual({ type: "completed", payload: { receipt: "r-1" } });
    if (outcome?.type === "completed") {
      const receipt: string | undefined = outcome.payload?.receipt;
      expect(receipt).toBe("r-1");
    }
  });

  it("rejects payloads that do not match the declaration", async () => {
    const machine = createGraphJourney(definition);
    machine.controls.start();
    await flush();

    // @ts-expect-error completion payload is { receipt: string }, not a string
    machine.controls.complete("nope");
    // @ts-expect-error termination payload is the literal "cancelled"
    machine.controls.terminate("something-else");

    expect(machine.getSnapshot().status).toBe("terminated");
  });
});

describe("plugins index rejects undeclared names on both tiers", () => {
  it("rejects a typo on a linear machine", () => {
    const machine = createLinearJourney({ steps: ["a", "b"], context: {} });

    // @ts-expect-error no plugins were declared, so no plugin API exists
    void machine.plugins.nopeNotAPlugin;

    expect(machine.plugins).toEqual({});
  });

  it("rejects a typo on a graph machine", () => {
    const machine = createGraphJourney(definition);

    // @ts-expect-error no plugins were declared, so no plugin API exists
    void machine.plugins.nopeNotAPlugin;

    expect(machine.plugins).toEqual({});
  });

  it("rejects a typo when the leading generics are supplied explicitly", () => {
    const machine = createLinearJourney<"a" | "b", { n: number }>({
      steps: ["a", "b"],
      context: { n: 0 }
    });

    // @ts-expect-error TPlugins falls back to its default, which must stay empty
    void machine.plugins.nopeNotAPlugin;

    expect(machine.plugins).toEqual({});
  });
});
