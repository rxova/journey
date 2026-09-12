import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import * as rootEntry from "@rxova/journey-react";
import * as clientEntry from "@rxova/journey-react/client";
import { createLinearJourney } from "@rxova/journey-react/client";
import { flush, makeStep } from "@rxova/journey-react/testing";

const StepA = makeStep("a");

/**
 * The `./client` entry is what Next.js App Router consumers import, and until
 * now nothing exercised it — the only check was a string match for the
 * "use client" directive against the built bundle.
 */
describe("client entry", () => {
  it("re-exports the root entry's full surface", () => {
    // A missing re-export would only surface in a consumer's app, since the
    // directive check in scripts/smoke.ts looks at bytes, not exports.
    expect(Object.keys(clientEntry).sort()).toEqual(Object.keys(rootEntry).sort());
  });

  it("builds a working bundle through the client entry", async () => {
    const journey = createLinearJourney({ context: { n: 0 }, steps: ["a", "b"] });
    render(
      <journey.Provider views={{ a: <StepA />, b: <StepA /> }}>
        <journey.StepRenderer fallback={<span>loading</span>} />
      </journey.Provider>
    );
    await flush();

    expect(screen.getByTestId("step-a")).toBeTruthy();
    expect(journey.machine.getSnapshot().currentStep?.id).toBe("a");
  });
});

// The "use client" directive itself is verified against the built bundles by
// scripts/smoke.ts, which is where it actually has to survive.
