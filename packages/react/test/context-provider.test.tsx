import { describe, expect, it, vi } from "vitest";

import React from "react";
import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";

import * as core from "@rxova/journey-core";
import * as corePersistence from "@rxova/journey-core/persistence";
import type { JourneyMachine, JourneyObservationEvent } from "@rxova/journey-core";
import {
  createJourneyBindings,
  type JourneyApi,
  type JourneyReactDefinition
} from "@rxova/journey-react";

type StepId = "one" | "two";
type Context = { count: number };
type Event = "goToNextStep" | "back" | "terminateJourney" | "completeJourney";

const StepOne = () => <div>one</div>;
const StepTwo = () => <div>two</div>;

const journey: JourneyReactDefinition<Context, StepId, Event> = {
  initial: "one",
  context: { count: 0 },
  steps: {
    one: { component: StepOne },
    two: { component: StepTwo }
  },
  transitions: [
    { from: "one", event: "goToNextStep", to: "two" },
    { from: "one", event: "terminateJourney" },
    { from: "two", event: "completeJourney" }
  ]
};

const bindings = createJourneyBindings(journey);

const CaptureApi = ({
  onApi
}: {
  onApi: (api: JourneyApi<Context, StepId, Event, Record<never, never>, unknown>) => void;
}) => {
  const api = bindings.useJourneyApi();

  React.useLayoutEffect(() => {
    onApi(api);
  }, [api, onApi]);

  return null;
};

describe("bindings.Provider", () => {
  it("provides machine and journey values via hooks", () => {
    const machine = core.createJourneyMachine(journey);

    const ReadStore = () => {
      const resolvedMachine = bindings.useJourneyMachine();
      const snapshot = bindings.useJourneySnapshot();
      const sameMachine = resolvedMachine === machine ? "same" : "diff";
      return (
        <div data-testid="store">
          {sameMachine}:{snapshot.currentStepId}
        </div>
      );
    };

    render(
      <bindings.Provider machine={machine}>
        <ReadStore />
      </bindings.Provider>
    );

    expect(screen.getByTestId("store").textContent).toBe("same:one");
  });

  it("supports external machines whose subscribe/getSnapshot rely on this", async () => {
    const machine = core.createJourneyMachine(journey);
    const externalMachine: JourneyMachine<Context, StepId, Event> & {
      inner: JourneyMachine<Context, StepId, Event>;
    } = {
      ...machine,
      inner: machine,
      getSnapshot() {
        return this.inner.getSnapshot();
      },
      subscribe(listener) {
        return this.inner.subscribe(listener);
      }
    };

    const ReadStore = () => {
      const snapshot = bindings.useJourneySnapshot();
      return <div data-testid="store">{snapshot.currentStepId}</div>;
    };

    render(
      <bindings.Provider machine={externalMachine}>
        <ReadStore />
        <bindings.StepRenderer />
      </bindings.Provider>
    );

    expect(screen.getByTestId("store").textContent).toBe("one");
    expect(screen.getAllByText("one")).toHaveLength(2);

    await act(async () => {
      await externalMachine.goToNextStep();
    });

    expect(screen.getByTestId("store").textContent).toBe("two");
    expect(screen.getAllByText("two")).toHaveLength(2);
  });

  it("calls onComplete for internal machines", async () => {
    let api: JourneyApi<Context, StepId, Event> | null = null;
    const onComplete = vi.fn();

    render(
      <bindings.Provider onComplete={onComplete}>
        <CaptureApi onApi={(nextApi) => (api = nextApi)} />
      </bindings.Provider>
    );

    await act(async () => {
      await api?.goToNextStep();
      await api?.completeJourney();
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "journey.complete",
        stepId: "two",
        timestamp: expect.any(Number)
      })
    );
  });

  it("auto-completes on goToNextStep for internal machines by default", async () => {
    const localJourney: JourneyReactDefinition<Context, StepId, Event> = {
      initial: "one",
      context: { count: 0 },
      steps: {
        one: { component: StepOne },
        two: { component: StepTwo }
      },
      transitions: [{ from: "one", event: "goToNextStep", to: "two" }]
    };
    const localBindings = createJourneyBindings(localJourney);
    let api: JourneyApi<Context, StepId, Event> | null = null;
    const onComplete = vi.fn();
    const CaptureLocalApi = () => {
      const localApi = localBindings.useJourneyApi();

      React.useLayoutEffect(() => {
        api = localApi;
      }, [localApi]);

      return null;
    };

    render(
      <localBindings.Provider onComplete={onComplete}>
        <CaptureLocalApi />
      </localBindings.Provider>
    );

    await act(async () => {
      await api?.goToNextStep();
      await api?.goToNextStep();
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "journey.complete",
        stepId: "two",
        timestamp: expect.any(Number)
      })
    );
  });

  it("can opt out of goToNextStep auto-completion for internal machines", async () => {
    const localJourney: JourneyReactDefinition<Context, StepId, Event> = {
      initial: "one",
      context: { count: 0 },
      steps: {
        one: { component: StepOne },
        two: { component: StepTwo }
      },
      transitions: [{ from: "one", event: "goToNextStep", to: "two" }]
    };
    const localBindings = createJourneyBindings(localJourney);
    let api: JourneyApi<Context, StepId, Event> | null = null;
    const onComplete = vi.fn();
    const CaptureLocalApi = () => {
      const localApi = localBindings.useJourneyApi();

      React.useLayoutEffect(() => {
        api = localApi;
      }, [localApi]);

      return null;
    };

    render(
      <localBindings.Provider completeOnNoNextStep={false} onComplete={onComplete}>
        <CaptureLocalApi />
      </localBindings.Provider>
    );

    await act(async () => {
      await api?.goToNextStep();
      await api?.goToNextStep();
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("calls onTerminate for internal machines", async () => {
    let api: JourneyApi<Context, StepId, Event> | null = null;
    const onTerminate = vi.fn();

    render(
      <bindings.Provider onTerminate={onTerminate}>
        <CaptureApi onApi={(nextApi) => (api = nextApi)} />
      </bindings.Provider>
    );

    await act(async () => {
      await api?.terminateJourney();
    });

    expect(onTerminate).toHaveBeenCalledTimes(1);
    expect(onTerminate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "journey.close",
        stepId: "one",
        timestamp: expect.any(Number)
      })
    );
  });

  it("calls onStart for internal machines", async () => {
    const onStart = vi.fn();

    render(
      <bindings.Provider onStart={onStart}>
        <div>child</div>
      </bindings.Provider>
    );

    await waitFor(() => {
      expect(onStart).toHaveBeenCalledTimes(1);
    });
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "journey.start",
        stepId: "one",
        timestamp: expect.any(Number)
      })
    );
  });

  it("calls provider lifecycle callbacks for external machines", async () => {
    const machine = core.createJourneyMachine(journey);
    const onStart = vi.fn();
    const onComplete = vi.fn();
    const onTerminate = vi.fn();
    const externalMachine: JourneyMachine<Context, StepId, Event> & {
      inner: JourneyMachine<Context, StepId, Event>;
    } = {
      ...machine,
      inner: machine,
      getSnapshot() {
        return this.inner.getSnapshot();
      },
      subscribe(listener) {
        return this.inner.subscribe(listener);
      }
    };

    render(
      <bindings.Provider
        machine={externalMachine}
        onStart={onStart}
        onComplete={onComplete}
        onTerminate={onTerminate}
      >
        <div>child</div>
      </bindings.Provider>
    );

    await waitFor(() => {
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await externalMachine.terminateJourney();
    });

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "journey.start",
        stepId: "one",
        timestamp: expect.any(Number)
      })
    );
    expect(onTerminate).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("does not fire lifecycle callbacks on mount for already terminal machines", async () => {
    const machine = core.createJourneyMachine(journey);
    const onComplete = vi.fn();
    const onTerminate = vi.fn();

    await act(async () => {
      await machine.goToNextStep();
      await machine.completeJourney();
    });

    render(
      <bindings.Provider machine={machine} onComplete={onComplete} onTerminate={onTerminate}>
        <div>child</div>
      </bindings.Provider>
    );

    expect(onComplete).not.toHaveBeenCalled();
    expect(onTerminate).not.toHaveBeenCalled();
  });

  it("keeps one terminal subscription across callback identity changes", async () => {
    const machine = core.createJourneyMachine(journey);
    const baseSubscribeComplete = machine.subscribeComplete.bind(machine);
    let unsubscribeCalls = 0;
    const firstOnComplete = vi.fn();
    const nextOnComplete = vi.fn();

    const subscribeComplete = vi.fn((...args: Parameters<typeof machine.subscribeComplete>) => {
      const unsubscribe = baseSubscribeComplete(...args);
      return () => {
        unsubscribeCalls += 1;
        unsubscribe();
      };
    });

    const instrumentedMachine: JourneyMachine<Context, StepId, Event> = {
      ...machine,
      subscribeComplete
    };

    const Harness = ({
      onComplete
    }: {
      onComplete: (
        event: Extract<JourneyObservationEvent<StepId, Event>, { type: "journey.complete" }>
      ) => void;
    }) => (
      <bindings.Provider machine={instrumentedMachine} onComplete={onComplete}>
        <div>child</div>
      </bindings.Provider>
    );

    const { rerender, unmount } = render(<Harness onComplete={firstOnComplete} />);

    expect(subscribeComplete).toHaveBeenCalledTimes(1);

    rerender(<Harness onComplete={nextOnComplete} />);

    expect(subscribeComplete).toHaveBeenCalledTimes(1);

    await act(async () => {
      await machine.goToNextStep();
      await machine.completeJourney();
    });

    expect(firstOnComplete).not.toHaveBeenCalled();
    expect(nextOnComplete).toHaveBeenCalledTimes(1);

    unmount();

    expect(unsubscribeCalls).toBe(1);
  });

  it("keeps one start subscription across callback identity changes", async () => {
    const machine = core.createJourneyMachine(journey);
    const baseSubscribeStart = machine.subscribeStart.bind(machine);
    let unsubscribeCalls = 0;
    const firstOnStart = vi.fn();
    const nextOnStart = vi.fn();

    const subscribeStart = vi.fn((...args: Parameters<typeof machine.subscribeStart>) => {
      const unsubscribe = baseSubscribeStart(...args);
      return () => {
        unsubscribeCalls += 1;
        unsubscribe();
      };
    });

    const instrumentedMachine: JourneyMachine<Context, StepId, Event> = {
      ...machine,
      subscribeStart
    };

    const Harness = ({
      onStart
    }: {
      onStart: (
        event: Extract<JourneyObservationEvent<StepId, Event>, { type: "journey.start" }>
      ) => void;
    }) => (
      <bindings.Provider machine={instrumentedMachine} onStart={onStart}>
        <div>child</div>
      </bindings.Provider>
    );

    const { rerender, unmount } = render(<Harness onStart={firstOnStart} />);

    await waitFor(() => {
      expect(firstOnStart).toHaveBeenCalledTimes(1);
    });
    expect(subscribeStart).toHaveBeenCalledTimes(1);

    rerender(<Harness onStart={nextOnStart} />);

    expect(subscribeStart).toHaveBeenCalledTimes(1);
    expect(nextOnStart).not.toHaveBeenCalled();

    unmount();

    expect(unsubscribeCalls).toBe(1);
  });

  it("disposes internally owned machine on unmount", () => {
    const snapshot = core.createJourneyMachine(journey).getSnapshot();
    const dispose = vi.fn();

    const machine: JourneyMachine<Context, StepId, Event> = {
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
      dispose,
      subscribe: () => () => undefined,
      subscribeSelector: () => () => undefined,
      subscribeEvent: () => () => undefined,
      subscribeStart: () => () => undefined,
      subscribeComplete: () => () => undefined,
      subscribeTerminate: () => () => undefined
    };

    const createMachineSpy = vi
      .spyOn(corePersistence, "createJourneyMachine")
      .mockReturnValue(machine as never);
    const localBindings = createJourneyBindings(journey);

    const { unmount } = render(
      <localBindings.Provider>
        <div>child</div>
      </localBindings.Provider>
    );

    expect(createMachineSpy).toHaveBeenCalledTimes(1);
    unmount();
    expect(dispose).toHaveBeenCalledTimes(1);

    createMachineSpy.mockRestore();
  });
});
