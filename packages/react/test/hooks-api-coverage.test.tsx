import { describe, expect, it, vi } from "vitest";

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import {
  JOURNEY_STATUS,
  createJourneyMachine,
  type JourneyMachine,
  type JourneySendResult,
  type JourneySnapshot
} from "@rxova/journey-core";
import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "one" | "two";
type Context = { count: number };
type Event =
  | "goToNextStep"
  | "goToPreviousStep"
  | "terminateJourney"
  | "completeJourney"
  | "custom";
type Meta = { title: string };

const journey: JourneyReactDefinition<Context, StepId, Event, Record<never, never>, Meta> = {
  initial: "one",
  context: { count: 0 },
  steps: {
    one: { component: () => <div>one</div>, meta: { title: "One" } },
    two: { component: () => <div>two</div>, meta: { title: "Two" } }
  },
  transitions: [{ from: "one", event: "goToNextStep", to: "two" }]
};

const bindings = createJourneyBindings(journey);

const snapshot: JourneySnapshot<Context, StepId, Meta> = {
  currentStepId: "one",
  history: {
    timeline: ["one"],
    index: 0
  },
  context: { count: 0 },
  visited: { one: true, two: false },
  stepMeta: {
    one: { title: "One" },
    two: { title: "Two" }
  },
  status: JOURNEY_STATUS.RUNNING,
  async: {
    isLoading: false,
    byStep: {
      one: { phase: "idle", eventType: null, transitionId: null, error: null },
      two: { phase: "idle", eventType: null, transitionId: null, error: null }
    }
  }
};

const sendResult: JourneySendResult<Context, StepId, Meta> = {
  transitioned: true,
  snapshot
};

describe("useJourneyApi", () => {
  it("delegates all api calls to the machine", async () => {
    const send = vi.fn(async () => sendResult);
    const goToNextStep = vi.fn(async () => sendResult);
    const terminateJourney = vi.fn(async () => sendResult);
    const completeJourney = vi.fn(async () => sendResult);
    const goToPreviousStep = vi.fn(async () => sendResult);
    const goToLastVisitedStep = vi.fn(async () => sendResult);
    const updateContext = vi.fn(() => snapshot);
    const updateStepMetadata = vi.fn(() => snapshot);
    const clearStepError = vi.fn(() => snapshot);
    const resetMachine = vi.fn(() => snapshot);
    const dispose = vi.fn(() => undefined);

    const machine: JourneyMachine<Context, StepId, Event, Record<never, never>, Meta> = {
      getSnapshot: () => snapshot,
      send,
      goToNextStep,
      terminateJourney,
      completeJourney,
      goToPreviousStep,
      goToLastVisitedStep,
      updateContext,
      updateStepMetadata,
      clearStepError,
      resetMachine,
      dispose,
      subscribe: () => () => undefined,
      subscribeEvent: () => () => undefined
    };

    const Controls = () => {
      const api = bindings.useJourneyApi();

      return (
        <div>
          <button data-testid="send" onClick={() => void api.send({ type: "custom" })}>
            send
          </button>
          <button
            data-testid="goTo-send"
            onClick={() => void api.send({ type: "goToStepById", stepId: "two" })}
          >
            goTo-send
          </button>
          <button
            data-testid="goTo-send-payload"
            onClick={() =>
              void api.send({ type: "goToStepById", stepId: "two", payload: { reason: "manual" } })
            }
          >
            goTo-send-payload
          </button>
          <button data-testid="goToNextStep" onClick={() => void api.goToNextStep()}>
            next
          </button>
          <button data-testid="terminateJourney" onClick={() => void api.terminateJourney()}>
            close
          </button>
          <button data-testid="completeJourney" onClick={() => void api.completeJourney()}>
            submit
          </button>
          <button data-testid="prev" onClick={() => void api.goToPreviousStep(2)}>
            prev
          </button>
          <button data-testid="last" onClick={() => void api.goToLastVisitedStep()}>
            last
          </button>
          <button
            data-testid="ctx"
            onClick={() =>
              api.updateContext((context) => ({ ...context, count: context.count + 1 }))
            }
          >
            ctx
          </button>
          <button
            data-testid="meta"
            onClick={() =>
              api.updateStepMetadata("two", (meta) => ({ ...meta, title: `${meta.title}*` }))
            }
          >
            meta
          </button>
          <button
            data-testid="component-meta"
            onClick={() =>
              api.updateStepMetadata("two", (meta) => ({ ...meta, title: `${meta.title}**` }))
            }
          >
            component-meta
          </button>
          <button data-testid="clear" onClick={() => api.clearStepError("two")}>
            clear
          </button>
          <button data-testid="reset" onClick={() => api.resetJourney()}>
            reset
          </button>
        </div>
      );
    };

    render(
      <bindings.Provider machine={machine}>
        <Controls />
      </bindings.Provider>
    );

    fireEvent.click(screen.getByTestId("send"));
    fireEvent.click(screen.getByTestId("goTo-send"));
    fireEvent.click(screen.getByTestId("goTo-send-payload"));
    fireEvent.click(screen.getByTestId("goToNextStep"));
    fireEvent.click(screen.getByTestId("terminateJourney"));
    fireEvent.click(screen.getByTestId("completeJourney"));
    fireEvent.click(screen.getByTestId("prev"));
    fireEvent.click(screen.getByTestId("last"));
    fireEvent.click(screen.getByTestId("ctx"));
    fireEvent.click(screen.getByTestId("meta"));
    fireEvent.click(screen.getByTestId("component-meta"));
    fireEvent.click(screen.getByTestId("clear"));
    fireEvent.click(screen.getByTestId("reset"));

    expect(send).toHaveBeenCalledWith({ type: "custom" });
    expect(send).toHaveBeenCalledWith({ type: "goToStepById", stepId: "two" });
    expect(send).toHaveBeenCalledWith({
      type: "goToStepById",
      stepId: "two",
      payload: { reason: "manual" }
    });
    expect(goToNextStep).toHaveBeenCalledTimes(1);
    expect(terminateJourney).toHaveBeenCalledTimes(1);
    expect(completeJourney).toHaveBeenCalledTimes(1);

    expect(goToPreviousStep).toHaveBeenCalledWith(2);
    expect(goToLastVisitedStep).toHaveBeenCalledTimes(1);

    expect(updateContext).toHaveBeenCalledTimes(1);
    expect(updateStepMetadata).toHaveBeenCalledTimes(2);
    expect(clearStepError).toHaveBeenCalledWith("two");
    expect(resetMachine).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(0);
  });

  it("useJourneyMachine returns the same machine instance", () => {
    const machine = createJourneyMachine(journey);

    const ReadMachine = () => {
      const resolved = bindings.useJourneyMachine();
      return <div data-testid="machine">{resolved === machine ? "same" : "different"}</div>;
    };

    render(
      <bindings.Provider machine={machine}>
        <ReadMachine />
      </bindings.Provider>
    );

    expect(screen.getByTestId("machine").textContent).toBe("same");
  });

  it("returns a stable api object across unrelated parent rerenders", () => {
    const machine = createJourneyMachine(journey);
    const reportApiRef = vi.fn();

    const CaptureApi = () => {
      const api = bindings.useJourneyApi();

      React.useLayoutEffect(() => {
        reportApiRef(api);
      }, [api]);

      return null;
    };

    const Harness = () => {
      const [tick, setTick] = React.useState(0);

      return (
        <div>
          <button data-testid="rerender" onClick={() => setTick((value) => value + 1)}>
            rerender
          </button>
          <div data-testid="tick">{tick}</div>
          <bindings.Provider machine={machine}>
            <CaptureApi />
          </bindings.Provider>
        </div>
      );
    };

    render(<Harness />);

    expect(reportApiRef).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("rerender"));
    expect(screen.getByTestId("tick").textContent).toBe("1");
    expect(reportApiRef).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("rerender"));
    expect(screen.getByTestId("tick").textContent).toBe("2");
    expect(reportApiRef).toHaveBeenCalledTimes(1);
  });
});
