import { describe, expect, it, vi } from "vitest";
import { createLinearJourney } from "@rxova/journey-core";
import { createAnalyticsPlugin } from "@rxova/journey-core/analytics";
import type { AnalyticsTrackedEvent } from "@rxova/journey-core/analytics";
import { flush } from "@rxova/journey-core/testing";

async function startedWithAnalytics(track: (event: AnalyticsTrackedEvent) => void) {
  const machine = createLinearJourney(
    { steps: ["a", "b"], context: {} },
    { plugins: [createAnalyticsPlugin({ track, now: () => 1234 })] as const }
  );
  machine.controls.start();
  await flush();
  return machine;
}

describe("analytics plugin", () => {
  it("tracks lifecycle observations with timestamps and step context", async () => {
    const tracked: AnalyticsTrackedEvent[] = [];
    const machine = await startedWithAnalytics((event) => tracked.push(event));
    await machine.navigate.goToNextStep();
    await machine.navigate.goToPreviousStep(5); // out-of-bounds at index 0 later
    machine.controls.complete();

    const names = tracked.map((event) => event.name);
    expect(names).toEqual([
      "journey.running",
      "journey.transition",
      "journey.transition",
      "journey.transition",
      "journey.completed"
    ]);
    expect(tracked[1]).toMatchObject({
      timestamp: 1234,
      payload: { from: null, to: "a" }
    });
  });

  it("tracks blocked navigations and step errors", async () => {
    const tracked: AnalyticsTrackedEvent[] = [];
    const boom = new Error("enter failed");
    const machine = createLinearJourney(
      {
        steps: [
          "a",
          {
            id: "b",
            onEnter: () => {
              throw boom;
            }
          }
        ],
        context: {}
      },
      { plugins: [createAnalyticsPlugin({ track: (event) => tracked.push(event) })] as const }
    );
    machine.controls.start();
    await flush();
    await machine.navigate.goToPreviousStep();
    await machine.navigate.goToNextStep();

    const names = tracked.map((event) => event.name);
    expect(names).toContain("journey.navigationBlocked");
    expect(names).toContain("journey.error");
    const errorEvent = tracked.find((event) => event.name === "journey.error");
    expect(errorEvent?.payload).toMatchObject({ phase: "enter", stepId: "b", error: boom });
  });

  it("tracks custom events and keeps a recent-events buffer", async () => {
    const track = vi.fn();
    const machine = createLinearJourney(
      { steps: ["a"], context: {} },
      { plugins: [createAnalyticsPlugin({ track })] as const }
    );
    const api = machine.plugins.analytics;

    const custom = api.trackAnalyticsEvent("checkout.opened", { cart: 3 });
    expect(custom).toMatchObject({ name: "checkout.opened", payload: { cart: 3 } });
    expect(track).toHaveBeenCalledWith(custom);

    const recent = api.getRecentEvents();
    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({ source: "custom", success: true });

    api.clearRecentEvents();
    expect(api.getRecentEvents()).toEqual([]);
  });

  it("captures sink failures without breaking the machine", async () => {
    const onError = vi.fn();
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: {} },
      {
        plugins: [
          createAnalyticsPlugin({
            track: () => {
              throw new Error("sink down");
            },
            onError
          })
        ] as const
      }
    );
    machine.controls.start();
    await flush();
    expect(await machine.navigate.goToNextStep()).toEqual({ ok: true, from: "a", to: "b" });

    expect(onError).toHaveBeenCalled();
    const recent = machine.plugins.analytics.getRecentEvents();
    expect(recent.every((entry) => entry.success === false)).toBe(true);
  });
});

describe("analytics recent-events buffer", () => {
  it("is capped at 100 entries, dropping the oldest", () => {
    const machine = createLinearJourney(
      { steps: ["a"], context: {} },
      { plugins: [createAnalyticsPlugin({ track: () => undefined })] as const }
    );
    for (let index = 0; index < 130; index += 1) {
      machine.plugins.analytics.trackAnalyticsEvent(`event-${index}`);
    }
    const recent = machine.plugins.analytics.getRecentEvents();
    expect(recent).toHaveLength(100);
    expect(recent[0]?.tracked.name).toBe("event-30");
  });
});
