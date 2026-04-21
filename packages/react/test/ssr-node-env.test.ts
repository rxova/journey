// @vitest-environment node
// This file exercises the module-level branch in Provider.tsx and Hooks.tsx:
//   const useSafeLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;
// In the jsdom environment (all other tests), typeof window !== "undefined", so React.useLayoutEffect
// is always selected. This file runs in the Node environment where typeof window === "undefined",
// forcing the React.useEffect branch.
import { describe, expect, it } from "vitest";

import { createJourney } from "@rxova/journey-react";
import type { JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "end";
type Context = Record<never, never>;

const definition: JourneyDefinition<Context, StepId> = {
  initial: "start",
  context: {},
  steps: { start: {}, end: {} },
  transitions: {
    start: { goToNextStep: [{ to: "end" }] },
    end: { completeJourney: true }
  }
};

describe("SSR / Node environment", () => {
  it("createJourney creates a runtime without a DOM environment", () => {
    const journey = createJourney(definition);

    expect(typeof journey.machine).toBe("object");
    expect(typeof journey.dispose).toBe("function");
    expect(typeof journey.useJourneySnapshot).toBe("function");
    expect(typeof journey.useJourneyComputed).toBe("function");
    expect(typeof journey.useJourneySelector).toBe("function");
    expect(typeof journey.useJourneyApi).toBe("function");
    expect(typeof journey.useJourneyEvent).toBe("function");
    expect(typeof journey.useJourneyStepLifecycle).toBe("function");
    expect(typeof journey.JourneyProvider).toBe("function");
    expect(typeof journey.StepRenderer).toBe("function");

    journey.dispose();
  });
});
