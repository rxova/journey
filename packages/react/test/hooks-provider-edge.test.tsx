import { describe, expect, it } from "vitest";

import React from "react";
import { act } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import {
  createJourneyBindings,
  type JourneyApi,
  type JourneyReactDefinition
} from "@rxova/journey-react";

type StepId = "one" | "two";
type Event = "goToNextStep" | "back" | "terminateJourney" | "completeJourney";
type Context = { count: number };

const journeyA: JourneyReactDefinition<Context, StepId, Event> = {
  initial: "one",
  context: { count: 0 },
  steps: {
    one: { component: () => <div>one-a</div> },
    two: { component: () => <div>two-a</div> }
  },
  transitions: [{ from: "one", event: "goToNextStep", to: "two" }]
};

const journeyB: JourneyReactDefinition<Context, StepId, Event> = {
  initial: "one",
  context: { count: 10 },
  steps: {
    one: { component: () => <div>one-b</div> },
    two: { component: () => <div>two-b</div> }
  },
  transitions: [{ from: "one", event: "goToNextStep", to: "two" }]
};

const bindings = createJourneyBindings(journeyA);

const Capture = ({
  onApi
}: {
  onApi: (api: JourneyApi<Context, StepId, Event, Record<never, never>, unknown>) => void;
}) => {
  const snapshot = bindings.useJourneySnapshot();
  const api = bindings.useJourneyApi();

  React.useLayoutEffect(() => {
    onApi(api);
  }, [api, onApi]);

  return <div data-testid="current">{snapshot.currentStepId}</div>;
};

describe("bindings hooks edge cases", () => {
  it("throws outside Provider", () => {
    const UseJourneyApi = () => {
      bindings.useJourneyApi();
      return null;
    };
    const UseJourneySnapshot = () => {
      bindings.useJourneySnapshot();
      return null;
    };
    const UseJourneyMachine = () => {
      bindings.useJourneyMachine();
      return null;
    };

    expect(() => render(<UseJourneyApi />)).toThrow(/bindings\.Provider/);
    expect(() => render(<UseJourneySnapshot />)).toThrow(/bindings\.Provider/);
    expect(() => render(<UseJourneyMachine />)).toThrow(/bindings\.Provider/);
    expect(() => render(<bindings.StepRenderer />)).toThrow(/bindings\.Provider/);
  });

  it("does not reset internal machine on journey change unless resetOnJourneyChange=true", async () => {
    let api: JourneyApi<Context, StepId, Event> | null = null;

    const { rerender } = render(
      <bindings.Provider journey={journeyA}>
        <Capture onApi={(nextApi) => (api = nextApi)} />
        <bindings.StepRenderer />
      </bindings.Provider>
    );

    expect(screen.getByText("one-a")).toBeTruthy();

    await act(async () => {
      await api?.goToNextStep();
    });

    expect(screen.getByText("two-a")).toBeTruthy();

    rerender(
      <bindings.Provider journey={journeyB}>
        <Capture onApi={(nextApi) => (api = nextApi)} />
        <bindings.StepRenderer />
      </bindings.Provider>
    );

    expect(screen.getByText("two-a")).toBeTruthy();
    expect(screen.getByTestId("current").textContent).toBe("two");

    rerender(
      <bindings.Provider journey={journeyB} resetOnJourneyChange>
        <Capture onApi={(nextApi) => (api = nextApi)} />
        <bindings.StepRenderer />
      </bindings.Provider>
    );

    expect(screen.getByText("one-b")).toBeTruthy();
    expect(screen.getByTestId("current").textContent).toBe("one");
  });

  it("StepRenderer uses fallback when current step component is missing", async () => {
    const minimalJourney: JourneyReactDefinition<Context, StepId, Event> = {
      initial: "one",
      context: { count: 0 },
      steps: {
        one: { component: () => <div>one-min</div> },
        two: { component: undefined as unknown as React.ComponentType }
      },
      transitions: [{ from: "one", event: "goToNextStep", to: "two" }]
    };

    const localBindings = createJourneyBindings(minimalJourney);
    let api: JourneyApi<Context, StepId, Event> | null = null;

    const GrabApi = () => {
      const resolvedApi = localBindings.useJourneyApi();
      React.useLayoutEffect(() => {
        api = resolvedApi;
      }, [resolvedApi]);
      return null;
    };

    render(
      <localBindings.Provider>
        <GrabApi />
        <localBindings.StepRenderer fallback={<div>fallback</div>} />
      </localBindings.Provider>
    );

    expect(screen.getByText("one-min")).toBeTruthy();

    await act(async () => {
      await api?.goToNextStep();
    });

    expect(screen.getByText("fallback")).toBeTruthy();
  });

  it("StepRenderer remounts shared step components when step id changes", async () => {
    type LocalStepId = "one" | "two";
    let localBindings!: ReturnType<typeof createJourneyBindings<Context, LocalStepId, Event>>;
    let api: JourneyApi<Context, LocalStepId, Event> | null = null;

    const SharedStep = () => {
      const snapshot = localBindings.useJourneySnapshot();
      const [count, setCount] = React.useState(0);

      return (
        <div>
          <div data-testid="shared-step">{`${snapshot.currentStepId}:${count}`}</div>
          <button data-testid="increment" onClick={() => setCount((value) => value + 1)}>
            increment
          </button>
        </div>
      );
    };

    const journeyWithSharedStep: JourneyReactDefinition<Context, LocalStepId, Event> = {
      initial: "one",
      context: { count: 0 },
      steps: {
        one: { component: SharedStep },
        two: { component: SharedStep }
      },
      transitions: [{ from: "one", event: "goToNextStep", to: "two" }]
    };

    localBindings = createJourneyBindings(journeyWithSharedStep);

    const GrabApi = () => {
      const resolvedApi = localBindings.useJourneyApi();
      React.useLayoutEffect(() => {
        api = resolvedApi;
      }, [resolvedApi]);
      return null;
    };

    render(
      <localBindings.Provider>
        <GrabApi />
        <localBindings.StepRenderer />
      </localBindings.Provider>
    );

    expect(screen.getByTestId("shared-step").textContent).toBe("one:0");
    fireEvent.click(screen.getByTestId("increment"));
    expect(screen.getByTestId("shared-step").textContent).toBe("one:1");

    await act(async () => {
      await api?.goToNextStep();
    });

    expect(screen.getByTestId("shared-step").textContent).toBe("two:0");
  });
});
