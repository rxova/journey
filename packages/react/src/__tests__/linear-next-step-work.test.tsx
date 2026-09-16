import { describe, expect, it } from "vitest";
import { createLinearJourney } from "@rxova/journey-react";
import { flush } from "@rxova/journey-react/testing";

/**
 * The bundle's `goToNextStep` wrapper, driven without React. Explicit work is
 * forwarded verbatim rather than consulting the mounted-handler registry, and a
 * bundle that was never started has no current step to look a handler up for.
 */

describe("the linear bundle's goToNextStep wrapper", () => {
  it("forwards explicit work verbatim instead of consulting the registry", async () => {
    const journey = createLinearJourney({ context: {}, steps: ["a", "b"] }, { autoStart: true });
    await flush();
    const ran: string[] = [];

    const result = await journey.navigate.goToNextStep({
      run: ({ to }) => {
        ran.push(to);
      }
    });

    expect(result).toMatchObject({ ok: true, from: "a", to: "b" });
    expect(ran).toEqual(["b"]);
  });

  it("navigates without a handler when the bundle has no current step", async () => {
    const journey = createLinearJourney({ context: {}, steps: ["a", "b"] }, { autoStart: false });
    expect(journey.machine.getSnapshot().currentStep).toBeNull();

    const result = await journey.navigate.goToNextStep();

    expect(result.ok).toBe(false);
  });
});
