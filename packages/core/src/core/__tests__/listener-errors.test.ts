import { describe, expect, it, vi } from "vitest";
import { startedLinear } from "@rxova/journey-core/testing";

describe("onListenerError creation option", () => {
  it("routes a throwing event listener to the reporter and keeps others notified", async () => {
    const failure = new Error("bad listener");
    const reported: unknown[] = [];
    const machine = await startedLinear({ onListenerError: (error) => reported.push(error) });

    machine.subscriptions.subscribeEvent("stepEnter", () => {
      throw failure;
    });
    const seen: string[] = [];
    machine.subscriptions.subscribeEvent("stepEnter", ({ to }) => seen.push(to));

    await machine.navigate.goToNextStep();
    expect(reported).toEqual([failure]);
    expect(seen).toEqual(["b"]);
  });

  it("routes a throwing selector listener to the reporter", async () => {
    const failure = new Error("bad selector listener");
    const reported: unknown[] = [];
    const machine = await startedLinear({ onListenerError: (error) => reported.push(error) });

    machine.subscriptions.subscribeSelector(
      (snapshot) => snapshot.currentStep?.id,
      () => {
        throw failure;
      }
    );

    await machine.navigate.goToNextStep();
    expect(reported).toEqual([failure]);
  });

  it("does not console.error when a reporter is configured", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const machine = await startedLinear({ onListenerError: () => undefined });

    machine.subscriptions.subscribeEvent("stepEnter", () => {
      throw new Error("bad listener");
    });

    await machine.navigate.goToNextStep();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("a throwing reporter falls back to the console and never breaks notification", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reporterFailure = new Error("reporter blew up");
    const machine = await startedLinear({
      onListenerError: () => {
        throw reporterFailure;
      }
    });

    machine.subscriptions.subscribeEvent("stepEnter", () => {
      throw new Error("bad listener");
    });
    const seen: string[] = [];
    machine.subscriptions.subscribeEvent("stepEnter", ({ to }) => seen.push(to));

    await machine.navigate.goToNextStep();
    expect(seen).toEqual(["b"]);
    expect(consoleError).toHaveBeenCalledWith("[journey] subscriber threw:", reporterFailure);
    consoleError.mockRestore();
  });
});
