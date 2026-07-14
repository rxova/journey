import { describe, expect, it, vi } from "vitest";
import { startedLinear } from "@rxova/journey-core/testing";

describe("store subscriber isolation", () => {
  it("a throwing selector is isolated and other selectors still fire", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const machine = await startedLinear();
    machine.subscriptions.subscribeSelector(
      (snapshot) => {
        // valid at subscribe time; throws once the machine moves to "b"
        if (snapshot.currentStep?.id === "b") throw new Error("bad selector");
        return snapshot.currentStep?.id;
      },
      () => undefined
    );
    const ids: (string | undefined)[] = [];
    machine.subscriptions.subscribeSelector(
      (snapshot) => snapshot.currentStep?.id,
      (id) => ids.push(id)
    );

    await machine.navigate.goToNextStep();
    expect(ids).toEqual(["b"]);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("a throwing selector listener is isolated", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const machine = await startedLinear();
    machine.subscriptions.subscribeSelector(
      (snapshot) => snapshot.currentStep?.id,
      () => {
        throw new Error("bad listener");
      }
    );

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
