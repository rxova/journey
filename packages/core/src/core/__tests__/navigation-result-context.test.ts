import { describe, expect, it } from "vitest";
import { createGraphJourney } from "@rxova/journey-core";
import { flush, startedLinear } from "@rxova/journey-core/testing";

/**
 * The failure arm used to carry only `{ ok, reason, error? }`. A caller awaiting
 * `send()` or `goToStepById()` could see *that* navigation was rejected but not
 * *which* target was rejected, and had to subscribe to `navigationBlocked`
 * separately to find out.
 */
describe("a rejected navigation names its source and target", () => {
  it("reports the attempted target for an unknown step", async () => {
    const machine = await startedLinear();

    const result = await machine.navigate.goToStepById("nope" as "a");

    expect(result).toEqual({ ok: false, reason: "invalid-target", from: "a", to: "nope" });
  });

  it("reports the target on a no-op", async () => {
    const machine = await startedLinear();

    const result = await machine.navigate.goToStepById("a");

    expect(result).toEqual({ ok: false, reason: "no-op", from: "a", to: "a" });
  });

  it("reports the source when a timeline move runs past its edge", async () => {
    const machine = await startedLinear();

    const result = await machine.navigate.goToPreviousStep();

    expect(result).toEqual({ ok: false, reason: "out-of-bounds", from: "a", to: null });
  });

  it("reports the source when the machine is not running", async () => {
    const machine = await startedLinear();
    machine.controls.terminate();

    const result = await machine.navigate.goToNextStep();

    expect(result).toMatchObject({ ok: false, reason: "not-running", from: "a" });
  });

  it("carries source and error together when work fails", async () => {
    const machine = await startedLinear();
    const boom = new Error("work failed");

    const result = await machine.navigate.goToNextStep({
      run: () => {
        throw boom;
      }
    });
    await flush();

    expect(result).toEqual({ ok: false, reason: "error", from: "a", to: "b", error: boom });
  });

  it("reports a null target when a graph event matches no candidate", async () => {
    const machine = createGraphJourney({
      steps: { a: {}, b: {} },
      initial: "a",
      context: {},
      transitions: { GO: { from: "b", to: "a" } }
    });
    machine.controls.start();
    await flush();

    const result = await machine.send("GO");

    // No enabled candidate leaves from "a", so no target was ever resolved.
    expect(result).toEqual({ ok: false, reason: "no-enabled-transition", from: "a", to: null });
  });

  it("still reports source and target after disposal", async () => {
    const machine = await startedLinear();
    machine.dispose();

    const result = await machine.navigate.goToNextStep();

    expect(result).toMatchObject({ ok: false, reason: "disposed" });
  });
});
