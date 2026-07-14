import { describe, expect, it } from "vitest";
import { createLinearJourney } from "@rxova/journey-core";
import { createAnalyticsPlugin, RECENT_EVENT_CAPACITY } from "@rxova/journey-core/analytics";

describe("RECENT_EVENT_CAPACITY", () => {
  it("is the exact cap the recent-events buffer enforces", () => {
    const machine = createLinearJourney(
      { steps: ["a"], context: {} },
      { plugins: [createAnalyticsPlugin({ track: () => undefined })] as const }
    );
    for (let index = 0; index < RECENT_EVENT_CAPACITY + 10; index += 1) {
      machine.plugins.analytics.trackAnalyticsEvent(`event-${index}`);
    }
    expect(machine.plugins.analytics.getRecentEvents()).toHaveLength(RECENT_EVENT_CAPACITY);
  });
});
