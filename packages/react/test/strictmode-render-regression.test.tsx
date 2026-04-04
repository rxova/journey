import { describe, expect, it, vi } from "vitest";

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { createJourney } from "@rxova/journey-react";
import type { JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "details";
type Context = { count: number };

const journeyDefinition: JourneyDefinition<Context, StepId> = {
  initial: "start",
  context: { count: 0 },
  steps: {
    start: { meta: { label: "Start" } },
    details: { meta: { label: "Details" } }
  },
  transitions: {
    start: { goToNextStep: [{ to: "details" }] }
  }
};

const createInstrumentedJourney = () => {
  const journey = createJourney(journeyDefinition);
  const originalSubscribe = journey.machine.subscribe.bind(journey.machine);
  let adds = 0;
  let removes = 0;
  let active = 0;

  journey.machine.subscribe = ((listener: Parameters<typeof journey.machine.subscribe>[0]) => {
    adds += 1;
    active += 1;
    const unsubscribe = originalSubscribe(listener);
    return () => {
      active -= 1;
      removes += 1;
      unsubscribe();
    };
  }) as typeof journey.machine.subscribe;

  return {
    journey,
    counts: () => ({ adds, removes, active })
  };
};

const flushQueuedEffects = async (cycles = 2) => {
  for (let index = 0; index < cycles; index += 1) {
    await Promise.resolve();
  }
};

describe("StrictMode and render regressions", () => {
  it("does not leak subscriptions under StrictMode double-mount", () => {
    const { journey, counts } = createInstrumentedJourney();

    const ReadStep = () => {
      const snapshot = journey.useJourneySnapshot();
      return <div data-testid="step">{snapshot.currentStepId}</div>;
    };

    const { unmount } = render(
      <React.StrictMode>
        <ReadStep />
      </React.StrictMode>
    );

    expect(screen.getByTestId("step").textContent).toBe("start");
    expect(counts().adds).toBeGreaterThanOrEqual(1);
    expect(counts().active).toBe(1);

    unmount();

    expect(counts().active).toBe(0);
    expect(counts().removes).toBe(counts().adds);
  });

  it("uses selector subscriptions for provider status tracking", async () => {
    const journey = createJourney(journeyDefinition);
    const views = {
      start: () => <div data-testid="step-view">start</div>,
      details: () => <div data-testid="step-view">details</div>
    };
    const originalSubscribe = journey.machine.subscribe.bind(journey.machine);
    const originalSubscribeSelector = journey.machine.subscribeSelector.bind(journey.machine);
    let snapshotSubscriptions = 0;
    let selectorSubscriptions = 0;

    journey.machine.subscribe = ((listener: Parameters<typeof journey.machine.subscribe>[0]) => {
      snapshotSubscriptions += 1;
      return originalSubscribe(listener);
    }) as typeof journey.machine.subscribe;
    journey.machine.subscribeSelector = ((selector, listener, equalityFn) => {
      selectorSubscriptions += 1;
      return originalSubscribeSelector(selector, listener, equalityFn);
    }) as typeof journey.machine.subscribeSelector;

    render(
      <journey.JourneyProvider views={views}>
        <div data-testid="mounted">mounted</div>
      </journey.JourneyProvider>
    );

    await act(async () => {
      await flushQueuedEffects();
    });

    expect(screen.getByTestId("mounted").textContent).toBe("mounted");
    expect(selectorSubscriptions).toBeGreaterThanOrEqual(1);
    expect(snapshotSubscriptions).toBe(0);
    expect(journey.machine.getSnapshot().status).toBe("running");
  });

  it("does not rerender memoized context consumers on unrelated parent updates", () => {
    const journey = createJourney(journeyDefinition);
    const reportRender = vi.fn();

    const MemoConsumer = React.memo(() => {
      const snapshot = journey.useJourneySnapshot();

      React.useLayoutEffect(() => {
        reportRender(snapshot.currentStepId);
      });

      return <div data-testid="consumer">consumer</div>;
    });

    const Harness = () => {
      const [tick, setTick] = React.useState(0);

      return (
        <div>
          <button data-testid="rerender" onClick={() => setTick((value) => value + 1)}>
            rerender
          </button>
          <div data-testid="tick">{tick}</div>
          <MemoConsumer />
        </div>
      );
    };

    render(<Harness />);

    expect(screen.getByTestId("consumer").textContent).toBe("consumer");
    expect(reportRender).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("rerender"));
    expect(screen.getByTestId("tick").textContent).toBe("1");
    expect(reportRender).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("rerender"));
    expect(screen.getByTestId("tick").textContent).toBe("2");
    expect(reportRender).toHaveBeenCalledTimes(1);
  });

  it("useJourneyEvent receives journey.start inside JourneyProvider under StrictMode", async () => {
    const journey = createJourney(journeyDefinition);
    const views = {
      start: () => <div data-testid="step-view">start</div>,
      details: () => <div data-testid="step-view">details</div>
    };
    const observed: string[] = [];

    const Observer = () => {
      journey.useJourneyEvent((event) => {
        observed.push(event.type);
      });
      return null;
    };

    render(
      <React.StrictMode>
        <journey.JourneyProvider views={views}>
          <Observer />
          <journey.StepRenderer />
        </journey.JourneyProvider>
      </React.StrictMode>
    );

    await act(async () => {
      await flushQueuedEffects();
    });

    expect(screen.getByTestId("step-view").textContent).toBe("start");
    expect(observed).toContain("journey.start");
  });

  it("does not dispose the machine when JourneyProvider unmounts by default", async () => {
    const journey = createJourney(journeyDefinition);
    const views = {
      start: () => <div data-testid="step-view">start</div>,
      details: () => <div data-testid="step-view">details</div>
    };
    const disposeSpy = vi.spyOn(journey.machine, "dispose");

    const { unmount } = render(
      <journey.JourneyProvider views={views}>
        <journey.StepRenderer />
      </journey.JourneyProvider>
    );

    await act(async () => {
      await flushQueuedEffects();
    });

    expect(journey.machine.getSnapshot().status).toBe("running");
    expect(disposeSpy).not.toHaveBeenCalled();

    unmount();

    expect(disposeSpy).not.toHaveBeenCalled();
  });

  it("disposes the machine when JourneyProvider unmounts with disposeOnUnmount", async () => {
    vi.useFakeTimers();
    try {
      const journey = createJourney(journeyDefinition);
      const views = {
        start: () => <div data-testid="step-view">start</div>,
        details: () => <div data-testid="step-view">details</div>
      };
      const disposeSpy = vi.spyOn(journey.machine, "dispose");

      const { unmount } = render(
        <journey.JourneyProvider views={views} disposeOnUnmount>
          <journey.StepRenderer />
        </journey.JourneyProvider>
      );

      await act(async () => {
        await flushQueuedEffects();
      });

      expect(journey.machine.getSnapshot().status).toBe("running");
      expect(disposeSpy).not.toHaveBeenCalled();

      unmount();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(disposeSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps disposeOnUnmount StrictMode-safe during the development remount cycle", async () => {
    vi.useFakeTimers();
    try {
      const journey = createJourney(journeyDefinition);
      const views = {
        start: () => <div data-testid="step-view">start</div>,
        details: () => <div data-testid="step-view">details</div>
      };
      const disposeSpy = vi.spyOn(journey.machine, "dispose");

      const { unmount } = render(
        <React.StrictMode>
          <journey.JourneyProvider views={views} disposeOnUnmount>
            <journey.StepRenderer />
          </journey.JourneyProvider>
        </React.StrictMode>
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(screen.getByTestId("step-view").textContent).toBe("start");
      expect(journey.machine.getSnapshot().status).toBe("running");
      expect(disposeSpy).not.toHaveBeenCalled();

      await act(async () => {
        const result = await journey.machine.goToNextStep();
        expect(result.transitioned).toBe(true);
      });

      expect(screen.getByTestId("step-view").textContent).toBe("details");

      unmount();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(disposeSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not duplicate provider-owned startup under StrictMode", async () => {
    const journey = createJourney(journeyDefinition);
    const views = {
      start: () => <div data-testid="step-view">start</div>,
      details: () => <div data-testid="step-view">details</div>
    };
    const startEvents: Array<{ type: "journey.start"; stepId: StepId; timestamp: number }> = [];

    journey.machine.subscribeEvent((event) => {
      if (event.type === "journey.start") {
        startEvents.push(event);
      }
    });

    render(
      <React.StrictMode>
        <journey.JourneyProvider views={views}>
          <journey.StepRenderer />
        </journey.JourneyProvider>
      </React.StrictMode>
    );

    await act(async () => {
      await flushQueuedEffects();
    });

    expect(screen.getByTestId("step-view").textContent).toBe("start");
    expect(journey.machine.getSnapshot().status).toBe("running");
    expect(startEvents).toHaveLength(1);
  });

  it("keeps snapshot and selector reads aligned during startTransition rerenders", async () => {
    const journey = createJourney(journeyDefinition);
    const observedReads: Array<{ snapshot: StepId; selected: StepId; tick: number }> = [];
    let triggerTransition: (() => Promise<void>) | null = null;
    let latestApi: ReturnType<typeof journey.useJourneyApi> | null = null;

    const Probe = () => {
      const [tick, setTick] = React.useState(0);
      const snapshot = journey.useJourneySnapshot();
      const selectedStep = journey.useJourneySelector((nextSnapshot) => nextSnapshot.currentStepId);
      const api = journey.useJourneyApi();

      React.useLayoutEffect(() => {
        latestApi = api;
        triggerTransition = async () => {
          React.startTransition(() => {
            setTick((value) => value + 1);
          });
          await api.goToNextStep();
        };
        observedReads.push({
          snapshot: snapshot.currentStepId,
          selected: selectedStep,
          tick
        });
      });

      return (
        <div>
          <span data-testid="snapshot-step">{snapshot.currentStepId}</span>
          <span data-testid="selected-step">{selectedStep}</span>
          <span data-testid="tick">{tick}</span>
        </div>
      );
    };

    render(<Probe />);

    await act(async () => {
      await latestApi?.startJourney();
    });

    await act(async () => {
      await triggerTransition?.();
    });

    expect(screen.getByTestId("snapshot-step").textContent).toBe("details");
    expect(screen.getByTestId("selected-step").textContent).toBe("details");
    expect(screen.getByTestId("tick").textContent).toBe("1");
    expect(observedReads.every((entry) => entry.snapshot === entry.selected)).toBe(true);
  });
});
