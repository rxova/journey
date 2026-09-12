import { describe, expect, it, vi } from "vitest";
import { startedLinear } from "@rxova/journey-core/testing";

describe("store subscriber isolation", () => {
  it("a throwing listener is isolated and the others still fire", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const machine = await startedLinear();
    machine.subscriptions.subscribe(() => {
      throw new Error("bad listener");
    });
    const ids: (string | undefined)[] = [];
    machine.subscriptions.subscribe(() => ids.push(machine.getSnapshot().currentStep?.id));

    await machine.navigate.goToNextStep();
    // Two publishes per navigation: mid-flight then settled — see the
    // transition-phase test in subscriptions.test.ts.
    expect(ids).toEqual(["b", "b"]);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("a throwing listener does not fail the navigation that published", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const machine = await startedLinear();
    machine.subscriptions.subscribe(() => {
      throw new Error("bad listener");
    });

    expect(await machine.navigate.goToNextStep()).toEqual({ ok: true, from: "a", to: "b" });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("store after dispose", () => {
  it("event subscriptions registered after dispose are inert no-ops", async () => {
    const machine = await startedLinear();
    machine.dispose();
    const off = machine.subscriptions.subscribeEvent("stepEnter", () => {
      throw new Error("should never fire");
    });
    expect(off).toBeTypeOf("function");
    expect(() => off()).not.toThrow();
  });
});
