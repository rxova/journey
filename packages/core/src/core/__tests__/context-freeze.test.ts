import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLinearJourney } from "@rxova/journey-core";
import { flush } from "@rxova/journey-core/testing";

type DevGlobal = { __DEV__?: boolean };

describe("context freezing in development", () => {
  beforeEach(() => {
    (globalThis as DevGlobal).__DEV__ = true;
  });
  afterEach(() => {
    delete (globalThis as DevGlobal).__DEV__;
  });

  it("freezes the initial context so silent in-place mutation throws", () => {
    const machine = createLinearJourney({ context: { count: 0 }, steps: ["a", "b"] });
    const context = machine.getSnapshot().context;

    // Mutating in place publishes nothing and notifies nobody — the machine
    // cannot see it. Freezing turns that silent no-op into a throw.
    expect(() => {
      (context as { count: number }).count = 1;
    }).toThrow(TypeError);
    expect(machine.getSnapshot().context).toEqual({ count: 0 });
  });

  it("freezes the result of an update", () => {
    const machine = createLinearJourney({ context: { count: 0 }, steps: ["a", "b"] });
    machine.context.update((context) => ({ ...context, count: 7 }));

    const context = machine.getSnapshot().context;
    expect(context).toEqual({ count: 7 });
    expect(() => {
      (context as { count: number }).count = 8;
    }).toThrow(TypeError);
  });

  it("still allows replacing the context through the updater", () => {
    const machine = createLinearJourney({ context: { count: 0 }, steps: ["a", "b"] });
    machine.context.update(() => ({ count: 1 }));
    machine.context.update((context) => ({ count: context.count + 1 }));
    expect(machine.getSnapshot().context).toEqual({ count: 2 });
  });

  it("freezes the context staged by navigation work", async () => {
    const machine = createLinearJourney(
      { context: { count: 0 }, steps: ["a", "b"] },
      { autoStart: true }
    );
    await flush();
    await machine.navigate.goToNextStep({
      run: () => 5,
      commit: ({ result, updateContext }) => {
        updateContext(() => ({ count: result }));
      }
    });

    const context = machine.getSnapshot().context;
    expect(context).toEqual({ count: 5 });
    expect(() => {
      (context as { count: number }).count = 6;
    }).toThrow(TypeError);
  });

  it("leaves a primitive context alone", () => {
    const machine = createLinearJourney({ context: 0 as number, steps: ["a"] });
    expect(machine.getSnapshot().context).toBe(0);
  });

  it("freezes shallowly, leaving nested values mutable", () => {
    const machine = createLinearJourney({
      context: { nested: { n: 0 } },
      steps: ["a"]
    });
    const context = machine.getSnapshot().context;

    // Deep-freezing would cost a full walk per update and break Maps, Dates,
    // and class instances that legitimately live in a context.
    expect(() => {
      context.nested.n = 1;
    }).not.toThrow();
  });
});
