import { describe, expect, it } from "vitest";
import { createLinearJourney } from "@rxova/journey-core";
import { flush, startedLinear } from "@rxova/journey-core/testing";

describe("subscriptions", () => {
  it("subscribeSelector fires only when the selected value changes (Object.is default)", async () => {
    const machine = await startedLinear();
    const ids: (string | undefined)[] = [];
    machine.subscriptions.subscribeSelector(
      (snapshot) => snapshot.currentStep?.id,
      (id) => ids.push(id)
    );

    await machine.navigate.goToNextStep();
    machine.context.update((c) => ({ ...c, count: 1 })); // id unchanged → no fire
    await machine.navigate.goToNextStep();

    expect(ids).toEqual(["b", "c"]);
  });

  it("supports a custom equality function", async () => {
    const machine = await startedLinear();
    const seen: number[] = [];
    machine.subscriptions.subscribeSelector(
      (snapshot) => snapshot.history.timeline.length,
      (length) => seen.push(length),
      () => true // everything equal → never fires
    );
    await machine.navigate.goToNextStep();
    expect(seen).toEqual([]);
  });

  it("unsubscribe stops both selector and event listeners", async () => {
    const machine = await startedLinear();
    const calls: string[] = [];
    const offSelector = machine.subscriptions.subscribeSelector(
      (snapshot) => snapshot.currentStep?.id,
      () => calls.push("selector")
    );
    const offEvent = machine.subscriptions.subscribeEvent("stepEnter", () => calls.push("event"));
    offSelector();
    offEvent();

    await machine.navigate.goToNextStep();
    expect(calls).toEqual([]);
  });

  it("statusChange delivers previous and current status", async () => {
    const machine = createLinearJourney({ steps: ["a"], context: {} });
    const changes: string[] = [];
    machine.subscriptions.subscribeEvent("statusChange", ({ previous, current }) =>
      changes.push(`${previous}→${current}`)
    );
    machine.controls.start();
    await flush();
    machine.controls.complete();

    expect(changes).toEqual(["idle→running", "running→completed"]);
  });

  it("contextChange delivers previous and current context with the fresh snapshot", async () => {
    const machine = await startedLinear();
    const seen: unknown[] = [];
    machine.subscriptions.subscribeEvent("contextChange", ({ previous, current, snapshot }) =>
      seen.push({ previous, current, snapshotContext: snapshot.context })
    );

    machine.context.update((c) => ({ ...c, count: 7 }));
    expect(seen).toEqual([
      { previous: { count: 0 }, current: { count: 7 }, snapshotContext: { count: 7 } }
    ]);
  });

  it("navigationBlocked reports reason and attempted target", async () => {
    const machine = await startedLinear();
    const seen: unknown[] = [];
    machine.subscriptions.subscribeEvent("navigationBlocked", ({ reason, from, to }) =>
      seen.push({ reason, from, to })
    );

    await machine.navigate.goToPreviousStep();
    expect(seen).toEqual([{ reason: "out-of-bounds", from: "a", to: null }]);
  });

  it("subscriptions registered after dispose are inert", async () => {
    const machine = await startedLinear();
    machine.dispose();
    const off = machine.subscriptions.subscribeSelector(
      (snapshot) => snapshot.status,
      () => {
        throw new Error("should never fire");
      }
    );
    expect(off).toBeTypeOf("function");
    expect(() => off()).not.toThrow();
  });
});
