import { describe, expect, it } from "vitest";
import { createGraphJourney, createLinearJourney, type JourneyPlugin } from "@rxova/journey-core";
import { flush, wait } from "../../__tests__/helpers";

describe("runtime race branches", () => {
  it("dispose during a pending onLeave resolves the in-flight navigation as disposed", async () => {
    const machine = createLinearJourney({
      steps: [{ id: "a", onLeave: () => wait(30) }, "b"],
      context: {}
    });
    machine.controls.start();
    await flush();

    const navigation = machine.navigate.goToNextStep();
    machine.dispose();
    expect(await navigation).toEqual({ ok: false, reason: "disposed" });
  });

  it("terminate during a pending onEnter resolves the navigation as not-running", async () => {
    const machine = createLinearJourney({
      steps: ["a", { id: "b", onEnter: () => wait(30) }],
      context: {}
    });
    machine.controls.start();
    await flush();

    const navigation = machine.navigate.goToNextStep();
    await wait(5); // let the commit land, onEnter still pending
    expect(machine.controls.terminate()).toBe(true);
    expect(await navigation).toEqual({ ok: false, reason: "not-running" });
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
