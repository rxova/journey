import { describe, expect, it, vi } from "vitest";

import React from "react";
import { act } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import * as corePersistence from "@rxova/journey-core/persistence";
import type { JourneyStorage } from "@rxova/journey-core";
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

const createStorage = () => {
  const store = new Map<string, string>();
  const storage: JourneyStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    }
  };

  return { storage, store };
};

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
    const UseJourneySelector = () => {
      bindings.useJourneySelector((snapshot) => snapshot.currentStepId);
      return null;
    };
    const UseJourneyMachine = () => {
      bindings.useJourneyMachine();
      return null;
    };
    const UseJourneyEvent = () => {
      bindings.useJourneyEvent(() => undefined);
      return null;
    };

    expect(() => render(<UseJourneyApi />)).toThrow(/bindings\.Provider/);
    expect(() => render(<UseJourneySnapshot />)).toThrow(/bindings\.Provider/);
    expect(() => render(<UseJourneySelector />)).toThrow(/bindings\.Provider/);
    expect(() => render(<UseJourneyMachine />)).toThrow(/bindings\.Provider/);
    expect(() => render(<UseJourneyEvent />)).toThrow(/bindings\.Provider/);
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

    await waitFor(() => {
      expect(screen.getByText("one-b")).toBeTruthy();
    });
    expect(screen.getByTestId("current").textContent).toBe("one");
  });

  it("does not recreate the internal machine when persistence identity changes by default", async () => {
    const createMachineSpy = vi.spyOn(corePersistence, "createJourneyMachine");
    const { storage } = createStorage();
    let api: JourneyApi<Context, StepId, Event> | null = null;

    try {
      const { rerender } = render(
        <bindings.Provider persistence={{ key: "journey:persisted", storage }}>
          <Capture onApi={(nextApi) => (api = nextApi)} />
          <bindings.StepRenderer />
        </bindings.Provider>
      );

      expect(createMachineSpy).toHaveBeenCalledTimes(1);

      await act(async () => {
        await api?.goToNextStep();
      });

      expect(screen.getByText("two-a")).toBeTruthy();

      rerender(
        <bindings.Provider persistence={{ key: "journey:persisted", storage }}>
          <Capture onApi={(nextApi) => (api = nextApi)} />
          <bindings.StepRenderer />
        </bindings.Provider>
      );

      expect(screen.getByText("two-a")).toBeTruthy();
      expect(screen.getByTestId("current").textContent).toBe("two");
      expect(createMachineSpy).toHaveBeenCalledTimes(1);
    } finally {
      createMachineSpy.mockRestore();
    }
  });

  it("can rebuild the internal machine when resetOnPersistenceChange=true", async () => {
    const createMachineSpy = vi.spyOn(corePersistence, "createJourneyMachine");
    const { storage } = createStorage();
    let api: JourneyApi<Context, StepId, Event> | null = null;

    try {
      const { rerender } = render(
        <bindings.Provider
          persistence={{ key: "journey:persistence-a", storage }}
          resetOnPersistenceChange
        >
          <Capture onApi={(nextApi) => (api = nextApi)} />
          <bindings.StepRenderer />
        </bindings.Provider>
      );

      await act(async () => {
        await api?.goToNextStep();
      });

      expect(screen.getByText("two-a")).toBeTruthy();
      expect(createMachineSpy).toHaveBeenCalledTimes(1);

      rerender(
        <bindings.Provider
          persistence={{ key: "journey:persistence-b", storage }}
          resetOnPersistenceChange
        >
          <Capture onApi={(nextApi) => (api = nextApi)} />
          <bindings.StepRenderer />
        </bindings.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText("one-a")).toBeTruthy();
      });
      expect(screen.getByTestId("current").textContent).toBe("one");
      expect(createMachineSpy).toHaveBeenCalledTimes(2);
    } finally {
      createMachineSpy.mockRestore();
    }
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
