import { describe, expect, it, vi } from "vitest";

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { createJourney, useJourney, type JourneyViews } from "@rxova/journey-react";
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

const views: JourneyViews<StepId> = {
  start: () => <span>start</span>,
  details: () => <span>details</span>
};

const flushQueuedEffects = async (cycles = 2) => {
  for (let index = 0; index < cycles; index += 1) {
    await Promise.resolve();
  }
};

describe("useJourney", () => {
  it("creates the runtime exactly once and renders it", async () => {
    const factory = vi.fn(() => createJourney(journeyDefinition));

    const Owner = () => {
      const journey = useJourney(factory);
      return (
        <journey.JourneyProvider views={views}>
          <div data-testid="step">
            <journey.StepRenderer />
          </div>
        </journey.JourneyProvider>
      );
    };

    render(<Owner />);
    await act(async () => {
      await flushQueuedEffects();
    });

    expect(factory).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("step").textContent).toBe("start");
  });

  it("does not re-create the runtime under StrictMode's double-invoke render", () => {
    const factory = vi.fn(() => createJourney(journeyDefinition));

    const Owner = () => {
      const journey = useJourney(factory);
      return (
        <journey.JourneyProvider views={views}>
          <journey.StepRenderer />
        </journey.JourneyProvider>
      );
    };

    render(
      <React.StrictMode>
        <Owner />
      </React.StrictMode>
    );

    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("disposes on unmount, and survives the StrictMode mount/unmount/remount cycle", async () => {
    vi.useFakeTimers();
    try {
      let disposeCount = 0;
      const factory = () => {
        const journey = createJourney(journeyDefinition);
        const originalDispose = journey.dispose;
        return {
          ...journey,
          dispose: () => {
            disposeCount += 1;
            originalDispose();
          }
        };
      };

      const Owner = () => {
        const journey = useJourney(factory);
        return (
          <journey.JourneyProvider views={views}>
            <div data-testid="step">
              <journey.StepRenderer />
            </div>
          </journey.JourneyProvider>
        );
      };

      const { unmount } = render(
        <React.StrictMode>
          <Owner />
        </React.StrictMode>
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // The StrictMode remount cancels the scheduled disposal — the runtime stays
      // alive and usable.
      expect(disposeCount).toBe(0);
      expect(screen.getByTestId("step").textContent).toBe("start");

      unmount();
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // A real unmount disposes exactly once.
      expect(disposeCount).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives each mounted component an isolated runtime", async () => {
    const Card = ({ name }: { name: string }) => {
      const journey = useJourney(() => createJourney(journeyDefinition));
      const api = journey.useJourneyApi();
      return (
        <div>
          <journey.JourneyProvider views={views}>
            <span data-testid={`${name}-step`}>
              <journey.StepRenderer />
            </span>
          </journey.JourneyProvider>
          <button data-testid={`${name}-next`} onClick={() => void api.goToNextStep()}>
            next
          </button>
        </div>
      );
    };

    render(
      <>
        <Card name="a" />
        <Card name="b" />
      </>
    );
    await act(async () => {
      await flushQueuedEffects();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("a-next"));
      await flushQueuedEffects();
    });

    // Advancing card "a" must not move card "b".
    expect(screen.getByTestId("a-step").textContent).toBe("details");
    expect(screen.getByTestId("b-step").textContent).toBe("start");
  });

  it("renders to static markup without throwing (SSR smoke)", () => {
    const Owner = () => {
      const journey = useJourney(() => createJourney(journeyDefinition));
      return (
        <journey.JourneyProvider views={views}>
          <journey.StepRenderer />
        </journey.JourneyProvider>
      );
    };

    const html = renderToStaticMarkup(<Owner />);
    expect(html).toContain("start");
  });
});
