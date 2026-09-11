import { describe, expect, it } from "vitest";
import { createLinearJourney } from "@rxova/journey-core";
import { flush, startedLinear } from "@rxova/journey-core/testing";

describe("subscriptions", () => {
  it("subscribe fires on every committed snapshot, mid-flight ones included", async () => {
    const machine = await startedLinear();
    const seen: string[] = [];
    machine.subscriptions.subscribe(() => {
      const snapshot = machine.getSnapshot();
      seen.push(`${snapshot.currentStep?.id}:${snapshot.transition.phase ?? "settled"}`);
    });

    await machine.navigate.goToNextStep();

    // A navigation publishes twice — the step id moves first and the
    // transition settles second. Subscribers see both, which is what lets a
    // renderer show the in-flight state instead of only the resting one.
    expect(seen).toEqual(["b:entering", "b:settled"]);
  });

  it("does not de-duplicate by a derived value", async () => {
    const machine = await startedLinear();
    const ids: (string | undefined)[] = [];
    machine.subscriptions.subscribe(() => ids.push(machine.getSnapshot().currentStep?.id));

    // The step id is unchanged, but the context commit is still a commit. Core
    // notifies; skipping unchanged slices belongs to the caller, which is what
    // React's useSelector does (it must own that comparison anyway, to keep
    // render identity stable).
    machine.context.update((c) => ({ ...c, count: 1 }));

    expect(ids).toEqual(["a"]);
  });

  it("a publish that changes nothing is a no-op", async () => {
    const machine = await startedLinear();
    let calls = 0;
    machine.subscriptions.subscribe(() => {
      calls += 1;
    });

    // Structural sharing returns the previous snapshot verbatim, so no publish.
    machine.context.update((c) => c);
    expect(calls).toBe(0);
  });

  it("unsubscribe stops both snapshot and event listeners", async () => {
    const machine = await startedLinear();
    const calls: string[] = [];
    const offSnapshot = machine.subscriptions.subscribe(() => calls.push("snapshot"));
    const offEvent = machine.subscriptions.subscribeEvent("stepEnter", () => calls.push("event"));
    offSnapshot();
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
    const off = machine.subscriptions.subscribe(() => {
      throw new Error("should never fire");
    });
    expect(off).toBeTypeOf("function");
    expect(() => off()).not.toThrow();
  });
});
