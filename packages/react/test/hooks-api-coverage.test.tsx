import { describe, expect, it, vi } from "vitest";

import React from "react";
import { act, render, screen } from "@testing-library/react";

import { JOURNEY_ASYNC_PHASE, JOURNEY_STATUS, type JourneyMachine } from "@rxova/journey-core";
import { JourneyProvider } from "../src/context";
import { useJourneyApi, useJourneyMachine } from "../src/hooks";

type StepId = "one" | "two";

type Context = { count: number };

type Event = "next" | "back" | "close" | "submit";

const snapshot = {
  current: "one" as StepId,
  context: { count: 0 },
  history: [],
  visited: ["one" as StepId],
  status: JOURNEY_STATUS.RUNNING,
  async: {
    isLoading: false,
    byStep: {
      one: { phase: JOURNEY_ASYNC_PHASE.IDLE, eventType: null, transitionId: null, error: null },
      two: { phase: JOURNEY_ASYNC_PHASE.IDLE, eventType: null, transitionId: null, error: null }
    }
  }
};

describe("useJourneyApi", () => {
  it("exposes goTo, next, and updateContext helpers", async () => {
    const send: JourneyMachine<Context, StepId, Event>["send"] = vi.fn(async () => ({
      transitioned: true,
      snapshot
    }));
    const updateContext = vi.fn(() => snapshot);
    const trimHistory = vi.fn(() => snapshot);
    const clearHistory = vi.fn(() => snapshot);
    const machine: JourneyMachine<Context, StepId, Event> = {
      getSnapshot: () => snapshot,
      send,
      updateContext,
      clearStepError: () => snapshot,
      reset: () => snapshot,
      trimHistory,
      clearHistory,
      subscribe: () => () => {}
    };

    const Actions = () => {
      const api = useJourneyApi<Context, StepId, Event>();
      return (
        <div>
          <button onClick={() => api.goTo("two")} data-testid="goto">
            go
          </button>
          <button onClick={() => api.next()} data-testid="next">
            next
          </button>
          <button
            onClick={() => api.updateContext((ctx) => ({ ...ctx, count: ctx.count + 1 }))}
            data-testid="update"
          >
            update
          </button>
          <button onClick={() => api.trimHistory(1)} data-testid="trim">
            trim
          </button>
          <button onClick={() => api.clearHistory()} data-testid="clear">
            clear
          </button>
        </div>
      );
    };

    render(
      <JourneyProvider
        journey={{
          initial: "one",
          context: { count: 0 },
          steps: {
            one: { component: () => null },
            two: { component: () => null }
          },
          transitions: [{ from: "one", event: "next", to: "two" }]
        }}
        machine={machine}
      >
        <Actions />
      </JourneyProvider>
    );

    await act(async () => {
      screen.getByTestId("goto").click();
    });
    await act(async () => {
      screen.getByTestId("next").click();
    });
    await act(async () => {
      screen.getByTestId("update").click();
    });
    await act(async () => {
      screen.getByTestId("trim").click();
    });
    await act(async () => {
      screen.getByTestId("clear").click();
    });

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith({ type: "goTo", to: "two" });
    expect(send).toHaveBeenCalledWith({ type: "next" });
    expect(updateContext).toHaveBeenCalledTimes(1);
    expect(trimHistory).toHaveBeenCalledTimes(1);
    expect(trimHistory).toHaveBeenCalledWith(1);
    expect(clearHistory).toHaveBeenCalledTimes(1);
  });

  it("exposes the provider machine through useJourneyMachine", () => {
    const machine: JourneyMachine<Context, StepId, Event> = {
      getSnapshot: () => snapshot,
      send: async () => ({ transitioned: false, snapshot }),
      updateContext: () => snapshot,
      clearStepError: () => snapshot,
      reset: () => snapshot,
      trimHistory: () => snapshot,
      clearHistory: () => snapshot,
      subscribe: () => () => {}
    };

    const Probe = () => {
      const resolvedMachine = useJourneyMachine<Context, StepId, Event>();
      return <div data-testid="machine-ref">{String(resolvedMachine === machine)}</div>;
    };

    render(
      <JourneyProvider
        journey={{
          initial: "one",
          context: { count: 0 },
          steps: {
            one: { component: () => null },
            two: { component: () => null }
          },
          transitions: [{ from: "one", event: "next", to: "two" }]
        }}
        machine={machine}
      >
        <Probe />
      </JourneyProvider>
    );

    expect(screen.getByTestId("machine-ref").textContent).toBe("true");
  });
});
