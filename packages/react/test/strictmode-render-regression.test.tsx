import { describe, expect, it, vi } from "vitest";

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import {
  createJourneyMachine,
  type JourneyMachine,
  type JourneySnapshot
} from "@rxova/journey-core";
import {
  createJourneyBindings,
  type JourneyEventType,
  type JourneyReactDefinition
} from "@rxova/journey-react";

type StepId = "start" | "details";
type Context = { count: number };
type MachineEvent = JourneyEventType<never>;

const journey: JourneyReactDefinition<Context, StepId> = {
  initial: "start",
  context: { count: 0 },
  steps: {
    start: { component: () => <div>start</div> },
    details: { component: () => <div>details</div> }
  },
  transitions: [{ from: "start", event: "goToNextStep", to: "details" }]
};

const bindings = createJourneyBindings(journey);

const createSnapshot = (): JourneySnapshot<Context, StepId> => ({
  currentStepId: "start",
  history: {
    timeline: ["start"],
    index: 0
  },
  context: { count: 0 },
  visited: { start: true, details: false },
  stepMeta: {
    start: undefined,
    details: undefined
  },
  status: "running",
  async: {
    isLoading: false,
    byStep: {
      start: { phase: "idle", eventType: null, transitionId: null, error: null },
      details: { phase: "idle", eventType: null, transitionId: null, error: null }
    }
  }
});

const createInstrumentedMachine = () => {
  const listeners = new Set<() => void>();
  let adds = 0;
  let removes = 0;
  let active = 0;

  const snapshot = createSnapshot();
  const machine: JourneyMachine<Context, StepId, MachineEvent> = {
    getSnapshot: () => snapshot,
    send: async () => ({ transitioned: false, snapshot }),
    goToNextStep: async () => ({ transitioned: false, snapshot }),
    terminateJourney: async () => ({ transitioned: false, snapshot }),
    completeJourney: async () => ({ transitioned: false, snapshot }),
    goToPreviousStep: async () => ({ transitioned: false, snapshot }),
    goToLastVisitedStep: async () => ({ transitioned: false, snapshot }),
    updateContext: () => snapshot,
    updateStepMetadata: () => snapshot,
    clearStepError: () => snapshot,
    resetMachine: () => snapshot,
    dispose: () => undefined,
    subscribe: (
      listener: Parameters<JourneyMachine<Context, StepId, MachineEvent>["subscribe"]>[0]
    ) => {
      adds += 1;
      active += 1;
      listeners.add(listener);
      return () => {
        if (listeners.delete(listener)) {
          active -= 1;
          removes += 1;
        }
      };
    },
    subscribeSelector: () => () => undefined,
    subscribeEvent: () => () => undefined,
    subscribeStart: () => () => undefined,
    subscribeComplete: () => () => undefined,
    subscribeTerminate: () => () => undefined
  };

  return {
    machine,
    counts: () => ({ adds, removes, active })
  };
};

describe("StrictMode and render regressions", () => {
  it("does not leak subscriptions under StrictMode double-mount", () => {
    const { machine, counts } = createInstrumentedMachine();

    const ReadStep = () => {
      const snapshot = bindings.useJourneySnapshot();
      return <div data-testid="step">{snapshot.currentStepId}</div>;
    };

    const { unmount } = render(
      <React.StrictMode>
        <bindings.Provider machine={machine}>
          <ReadStep />
        </bindings.Provider>
      </React.StrictMode>
    );

    expect(screen.getByTestId("step").textContent).toBe("start");
    expect(counts().adds).toBeGreaterThanOrEqual(1);
    expect(counts().active).toBe(1);

    unmount();

    expect(counts().active).toBe(0);
    expect(counts().removes).toBe(counts().adds);
  });

  it("does not rerender memoized context consumers on unrelated parent updates", () => {
    const machine = createJourneyMachine(journey);
    const reportRender = vi.fn();

    const MemoConsumer = React.memo(() => {
      bindings.useJourneyMachine();

      React.useLayoutEffect(() => {
        reportRender();
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
          <bindings.Provider machine={machine}>
            <MemoConsumer />
          </bindings.Provider>
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
});
