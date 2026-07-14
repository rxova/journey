import { describe, expect, it, vi } from "vitest";

import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";
import { createAnalyticsPlugin } from "@rxova/journey-core/analytics";

type StepId = "start" | "review";
type Context = {
  count: number;
  account: {
    id: string;
    secret: string;
  };
};
type Meta = {
  title: string;
};

const createJourney = (
  options: {
    failOnNextStep?: boolean;
    reviewMeta?: Meta | undefined;
  } = {}
): JourneyDefinition<Context, StepId, never, Meta> => {
  const failOnNextStep = options.failOnNextStep ?? false;
  const reviewMeta =
    "reviewMeta" in options ? options.reviewMeta : ({ title: "Review" } satisfies Meta);

  return {
    initial: "start",
    context: {
      count: 0,
      account: {
        id: "user-1",
        secret: "do-not-track"
      }
    },
    steps: {
      start: { meta: { title: "Start" } },
      review: reviewMeta === undefined ? {} : { meta: reviewMeta }
    },
    transitions: {
      start: {
        goToNextStep: [
          {
            label: "start-review",
            to: "review",
            ...(failOnNextStep
              ? {
                  updateContext: () => {
                    throw new Error("transition failed");
                  }
                }
              : {})
          }
        ]
      },
      review: {
        completeJourney: true
      }
    }
  };
};

const findTracked = (track: ReturnType<typeof vi.fn>, name: string) =>
  track.mock.calls.find(([event]) => event.name === name)?.[0];

describe("analytics plugin", () => {
  it("tracks normalized journey events with projected context and step metadata", async () => {
    const track = vi.fn();
    const machine = createJourneyMachine(createJourney(), {
      plugins: [
        createAnalyticsPlugin({
          track,
          machineId: "checkout",
          includeStepMeta: true
        })
      ] as const
    });

    await machine.controls.start();
    await machine.goToNextStep();
    await machine.controls.complete();

    const names = track.mock.calls.map(([event]) => event.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "journey_started",
        "step_viewed",
        "transition_started",
        "transition_succeeded",
        "journey_completed"
      ])
    );

    const started = track.mock.calls.find(([event]) => event.name === "journey_started")?.[0];
    expect(started?.machineId).toBe("checkout");
    expect(started?.payload.context).toEqual({
      count: 0,
      account: {
        id: "user-1",
        secret: "do-not-track"
      }
    });
    expect(started?.payload.stepMeta).toEqual({ title: "Start" });

    const transitionSucceeded = track.mock.calls.find(
      ([event]) => event.name === "transition_succeeded"
    )?.[0];
    expect(transitionSucceeded?.payload.transitionId).toEqual(expect.any(String));
    expect(transitionSucceeded?.payload.label).toBe("start-review");
    expect(transitionSucceeded?.payload.toStepMeta).toEqual({ title: "Review" });
  });

  it("supports custom analytics events through the machine extension", () => {
    const track = vi.fn();
    const machine = createJourneyMachine(createJourney(), {
      plugins: [
        createAnalyticsPlugin({
          track,
          machineId: "checkout"
        })
      ] as const
    });

    const tracked = machine.trackAnalyticsEvent("checkout_abandoned");

    expect(tracked.name).toBe("checkout_abandoned");
    expect(tracked.machineId).toBe("checkout");
    expect(tracked.payload).toEqual({});
    expect(track).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "checkout_abandoned",
        machineId: "checkout",
        payload: {}
      })
    );
  });

  it("routes tracker failures to onError without breaking the machine", async () => {
    const onError = vi.fn();
    const machine = createJourneyMachine(createJourney(), {
      plugins: [
        createAnalyticsPlugin({
          track: () => {
            throw new Error("tracker failed");
          },
          onError
        })
      ] as const
    });

    await machine.controls.start();
    await machine.goToNextStep();

    expect(onError).toHaveBeenCalled();
    expect(machine.getSnapshot().currentStepId).toBe("review");
  });

  it("tracks navigation and termination events when step metadata is missing", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-29T00:00:00.000Z"));

    try {
      const track = vi.fn();
      const machine = createJourneyMachine(createJourney({ reviewMeta: undefined }), {
        plugins: [
          createAnalyticsPlugin({
            track,
            includeStepMeta: true
          })
        ] as const
      });

      await machine.controls.start();

      vi.setSystemTime(new Date("2026-03-29T00:00:02.000Z"));
      await machine.goToNextStep();

      vi.setSystemTime(new Date("2026-03-29T00:00:05.000Z"));
      await machine.goToPreviousStep();

      vi.setSystemTime(new Date("2026-03-29T00:00:09.000Z"));
      await machine.goToLastVisitedStep();

      vi.setSystemTime(new Date("2026-03-29T00:00:12.000Z"));
      await machine.controls.terminate();

      const eventNames = track.mock.calls.map(([event]) => event.name);
      expect(eventNames).toEqual(
        expect.arrayContaining([
          "step_exited",
          "navigation_previous",
          "navigation_last_visited",
          "journey_terminated"
        ])
      );

      const transitionSucceeded = findTracked(track, "transition_succeeded");
      expect(transitionSucceeded?.machineId).toBeUndefined();
      expect(transitionSucceeded?.payload.fromStepMeta).toEqual({ title: "Start" });
      expect(transitionSucceeded?.payload).not.toHaveProperty("toStepMeta");

      const reviewViewed = track.mock.calls.find(
        ([event]) => event.name === "step_viewed" && event.payload.stepId === "review"
      )?.[0];
      expect(reviewViewed?.payload).not.toHaveProperty("stepMeta");

      const exitedStart = track.mock.calls.find(
        ([event]) => event.name === "step_exited" && event.payload.stepId === "start"
      )?.[0];
      expect(exitedStart?.payload.stepMeta).toEqual({ title: "Start" });
      expect(exitedStart?.payload.dwellMs).toBe(2000);

      const navigationPrevious = findTracked(track, "navigation_previous");
      expect(navigationPrevious?.payload).toMatchObject({
        from: "review",
        to: "start",
        requestedSteps: 1,
        appliedSteps: 1,
        toStepMeta: { title: "Start" }
      });
      expect(navigationPrevious?.payload).not.toHaveProperty("fromStepMeta");

      const navigationLastVisited = findTracked(track, "navigation_last_visited");
      expect(navigationLastVisited?.payload).toMatchObject({
        from: "start",
        to: "review",
        fromStepMeta: { title: "Start" }
      });
      expect(navigationLastVisited?.payload).not.toHaveProperty("toStepMeta");

      const terminated = findTracked(track, "journey_terminated");
      expect(terminated?.payload.stepId).toBe("review");
      expect(terminated?.payload.durationMs).toBe(12000);
      expect(terminated?.payload).not.toHaveProperty("stepMeta");
    } finally {
      vi.useRealTimers();
    }
  });

  it("tracks transition failures and warns in development when track throws without onError", async () => {
    vi.stubGlobal("__DEV__", true);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const track = vi.fn(() => {
      throw new Error("tracker failed");
    });
    const machine = createJourneyMachine(createJourney({ failOnNextStep: true }), {
      plugins: [
        createAnalyticsPlugin({
          track
        })
      ] as const
    });

    try {
      await machine.controls.start();
      await machine.goToNextStep();

      const failed = findTracked(track, "transition_failed");
      expect(failed?.payload).toMatchObject({
        from: "start",
        eventType: "goToNextStep",
        transitionId: expect.any(String),
        label: "start-review"
      });
      expect(failed?.payload.error).toBeInstanceOf(Error);
      expect(machine.getSnapshot().currentStepId).toBe("start");
      expect(warnSpy).toHaveBeenCalledWith(
        "Journey analytics track() threw without an onError handler.",
        expect.any(Error)
      );
    } finally {
      warnSpy.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("omits step metadata when includeStepMeta is false", async () => {
    const track = vi.fn();
    const machine = createJourneyMachine(createJourney(), {
      plugins: [
        createAnalyticsPlugin({
          track,
          includeStepMeta: false
        })
      ] as const
    });

    await machine.controls.start();
    await machine.goToNextStep();
    await machine.goToPreviousStep();
    await machine.controls.complete();

    const started = findTracked(track, "journey_started");
    const viewed = findTracked(track, "step_viewed");
    const succeeded = findTracked(track, "transition_succeeded");
    const previous = findTracked(track, "navigation_previous");
    const completed = findTracked(track, "journey_completed");

    expect(started?.payload).not.toHaveProperty("stepMeta");
    expect(viewed?.payload).not.toHaveProperty("stepMeta");
    expect(succeeded?.payload).not.toHaveProperty("fromStepMeta");
    expect(succeeded?.payload).not.toHaveProperty("toStepMeta");
    expect(previous?.payload).not.toHaveProperty("fromStepMeta");
    expect(previous?.payload).not.toHaveProperty("toStepMeta");
    expect(completed?.payload).not.toHaveProperty("stepMeta");
  });

  it("unsubscribes analytics listeners when the machine is disposed", async () => {
    const track = vi.fn();
    const machine = createJourneyMachine(createJourney(), {
      plugins: [
        createAnalyticsPlugin({
          track
        })
      ] as const
    });

    await machine.controls.start();
    expect(track).toHaveBeenCalled();

    track.mockClear();
    machine.dispose();

    const result = await machine.goToNextStep();
    expect(result.transitioned).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect(track).not.toHaveBeenCalled();
  });

  it("covers optional analytics envelope branches across unlabeled events", async () => {
    const trackWithoutMachineId = vi.fn();
    const unlabeledJourney = createJourney();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (unlabeledJourney.transitions as any).start.goToNextStep = [{ to: "review" }];
    const withoutMachineId = createJourneyMachine(unlabeledJourney, {
      plugins: [
        createAnalyticsPlugin({
          track: trackWithoutMachineId
        })
      ] as const
    });

    await withoutMachineId.controls.start();
    await withoutMachineId.goToNextStep();
    await withoutMachineId.controls.complete({ reason: "done" });

    const withoutMachineIdEvents = trackWithoutMachineId.mock.calls.map(([event]) => event);
    expect(withoutMachineIdEvents.every((event) => event.machineId === undefined)).toBe(true);
    expect(findTracked(trackWithoutMachineId, "transition_succeeded")?.payload).not.toHaveProperty(
      "label"
    );

    const trackWithMachineId = vi.fn();
    const withMachineId = createJourneyMachine(createJourney({ reviewMeta: undefined }), {
      plugins: [
        createAnalyticsPlugin({
          track: trackWithMachineId,
          machineId: "checkout"
        })
      ] as const
    });

    await withMachineId.controls.start();
    await withMachineId.goToNextStep();
    await withMachineId.goToPreviousStep();
    await withMachineId.goToLastVisitedStep();
    await withMachineId.controls.terminate({ reason: "abandoned" });

    expect(findTracked(trackWithMachineId, "navigation_previous")?.machineId).toBe("checkout");
    expect(findTracked(trackWithMachineId, "navigation_last_visited")?.machineId).toBe("checkout");
    expect(findTracked(trackWithMachineId, "journey_terminated")?.machineId).toBe("checkout");
  });

  it("handles analytics lifecycle events when timing state has not been initialized", () => {
    const track = vi.fn();
    let listener:
      | ((event: {
          type: string;
          timestamp: number;
          stepId?: StepId;
          from?: StepId;
          eventType?: string;
          transitionId?: string;
          error?: unknown;
        }) => void)
      | undefined;
    const plugin = createAnalyticsPlugin<Context, StepId>({
      track,
      machineId: "direct"
    });
    const hooks = plugin.setup();
    const extension = hooks.augmentMachine?.({
      machine: {
        subscribeEvent: (nextListener: typeof listener) => {
          listener = nextListener;
          return () => undefined;
        },
        getSnapshot: () => ({
          context: {
            count: 0,
            account: {
              id: "user-1",
              secret: "do-not-track"
            }
          }
        }),
        getStepMeta: () => undefined
      },
      journey: createJourney(),
      resolvedJourney: {} as never
    } as never) as {
      trackAnalyticsEvent: (name: string, payload?: Record<string, unknown>) => unknown;
    };

    listener?.({
      type: "step.exit",
      timestamp: 1,
      stepId: "start"
    });
    listener?.({
      type: "journey.completed",
      timestamp: 2,
      stepId: "review"
    });
    listener?.({
      type: "journey.terminated",
      timestamp: 3,
      stepId: "review"
    });
    listener?.({
      type: "transition.error",
      timestamp: 4,
      from: "start",
      eventType: "goToNextStep",
      transitionId: "t-direct",
      error: new Error("direct")
    });

    const custom = extension.trackAnalyticsEvent("direct_custom", { ok: true });

    expect(custom).toMatchObject({ name: "direct_custom", machineId: "direct" });
    expect(findTracked(track, "step_exited")?.payload).not.toHaveProperty("dwellMs");
    expect(findTracked(track, "journey_completed")?.payload).not.toHaveProperty("durationMs");
    expect(findTracked(track, "journey_terminated")?.payload).not.toHaveProperty("durationMs");
    expect(findTracked(track, "transition_failed")?.payload).not.toHaveProperty("label");
  });

  it("isolates analytics subscriptions per machine when one plugin instance is reused", async () => {
    const track = vi.fn();
    const plugin = createAnalyticsPlugin({ track });
    const m1 = createJourneyMachine(createJourney(), { plugins: [plugin] as const });
    const m2 = createJourneyMachine(createJourney(), { plugins: [plugin] as const });

    await m1.controls.start();
    await m2.controls.start();

    // Disposing m1 must tear down only m1's subscription — m2 keeps tracking.
    m1.dispose();
    track.mockClear();

    await m2.send({ type: "goToNextStep" });

    expect(track).toHaveBeenCalled();
    m2.dispose();
  });
});
