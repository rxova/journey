import { describe, expect, it } from "vitest";
import { createGraphJourney, createLinearJourney, type JourneyPlugin } from "@rxova/journey-core";
import { flush, wait } from "@rxova/journey-core/testing";

describe("runtime race branches", () => {
  it("terminate during pre-commit work keeps the source and invalidates the operation", async () => {
    const machine = createLinearJourney({ steps: ["a", "b"], context: {} });
    machine.controls.start();
    await flush();

    const navigation = machine.navigate.goToNextStep({ run: () => wait(30) });
    expect(machine.controls.terminate()).toBe(true);

    expect(await navigation).toMatchObject({ ok: false, reason: "not-running" });
    expect(machine.getSnapshot().currentStep?.id).toBe("a");
    expect(machine.getSnapshot().currentStep?.async.isLoading).toBe(false);
  });

  it("dispose during a post-commit onLeave keeps the committed navigation successful", async () => {
    const machine = createLinearJourney({
      steps: [{ id: "a", onLeave: () => wait(30) }, "b"],
      context: {}
    });
    machine.controls.start();
    await flush();

    const navigation = machine.navigate.goToNextStep();
    machine.dispose();
    expect(await navigation).toEqual({ ok: true, from: "a", to: "b" });
  });

  it("terminate during a pending onEnter keeps the committed navigation successful", async () => {
    const machine = createLinearJourney({
      steps: ["a", { id: "b", onEnter: () => wait(30) }],
      context: {}
    });
    machine.controls.start();
    await flush();

    const navigation = machine.navigate.goToNextStep();
    await wait(5); // let the commit land, onEnter still pending
    expect(machine.controls.terminate()).toBe(true);
    expect(await navigation).toEqual({ ok: true, from: "a", to: "b" });
    expect(machine.getSnapshot().status).toBe("terminated");
  });

  it("drops queued raised events when a settle tap completes the journey", async () => {
    const completer: JourneyPlugin<"completer", undefined, never> = {
      name: "completer",
      setup(host) {
        host.onTransition(({ to }) => {
          if (to === "b") machineRef.controls.complete();
        });
        return {};
      }
    };
    const machine = createGraphJourney(
      {
        steps: {
          a: {
            onEnter: ({ raise }) => {
              raise({ type: "GO" });
              raise({ type: "GO" });
            }
          },
          b: {}
        },
        transitions: { GO: [{ from: "a", to: "b" }] },
        initial: "a",
        context: {}
      },
      { plugins: [completer] as const }
    );
    const machineRef = machine;
    machine.controls.start();
    await flush();
    await flush();

    // first raised GO lands on b, the tap completes, second GO is dropped
    expect(machine.getSnapshot().status).toBe("completed");
    expect(machine.getSnapshot().currentStep?.id).toBe("b");
  });

  it("fast hooks succeed unchanged when a timeout is configured", async () => {
    const machine = createLinearJourney(
      {
        steps: [
          { id: "a", onLeave: () => undefined },
          { id: "b", onEnter: async () => undefined }
        ],
        context: {}
      },
      { defaultTimeoutMs: 1000 }
    );
    machine.controls.start();
    await flush();
    expect(await machine.navigate.goToNextStep()).toEqual({ ok: true, from: "a", to: "b" });
    expect(machine.getSnapshot().currentStep?.async.isSuccess).toBe(true);
  });
});
