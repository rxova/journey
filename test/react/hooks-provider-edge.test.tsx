import { describe, expect, it, vi } from "vitest";

import React from "react";
import { act, render, screen } from "@testing-library/react";

import { HISTORY_TARGET, FLOW_TERMINAL, type FlowMachine } from "@/src";
import { FlowProvider, FlowStepRenderer, useFlow, useFlowApi, useFlowSnapshot } from "@/src";
import type { FlowReactFlow } from "@/src";

type StepId = "one" | "two" | "three";
type CustomEvent = "custom";
type Ctx = { counter: number; canAdvance: boolean; closed: boolean };
const idleStepAsync = () => ({
  phase: "idle" as const,
  eventType: null,
  transitionId: null,
  error: null
});
const asyncState = () => ({
  isLoading: false,
  byStep: {
    one: idleStepAsync(),
    two: idleStepAsync(),
    three: idleStepAsync()
  }
});

const One = () => <div data-testid="step">one</div>;
const Two = () => <div data-testid="step">two</div>;
const Three = () => <div data-testid="step">three</div>;

const baseFlow: FlowReactFlow<Ctx, StepId, CustomEvent> = {
  initial: "one",
  context: { counter: 0, canAdvance: true, closed: false },
  steps: {
    one: { component: One },
    two: { component: Two },
    three: { component: Three }
  },
  transitions: [
    {
      from: "one",
      event: "next",
      to: "two",
      when: ({ context }) => context.canAdvance
    },
    {
      from: "two",
      event: "next",
      to: "three"
    },
    {
      from: "*",
      event: "back",
      to: HISTORY_TARGET
    },
    {
      from: "*",
      event: "close",
      to: FLOW_TERMINAL.CLOSE
    },
    {
      from: "three",
      event: "submit",
      to: FLOW_TERMINAL.COMPLETE
    },
    {
      from: "one",
      event: "custom",
      to: "three"
    }
  ]
};

const Controls = () => {
  const { api, snapshot } = useFlow<Ctx, StepId, CustomEvent>();

  return (
    <div>
      <button onClick={() => api.next()}>next</button>
      <button onClick={() => api.back()}>back</button>
      <button onClick={() => api.close()}>close</button>
      <button onClick={() => api.submit()}>submit</button>
      <button onClick={() => api.goTo("three")}>goto</button>
      <button onClick={() => api.send({ type: "custom" })}>custom</button>
      <button
        onClick={() =>
          api.updateContext((ctx) => ({ ...ctx, counter: ctx.counter + 1, canAdvance: true }))
        }
      >
        increment
      </button>
      <button onClick={() => api.reset()}>reset</button>
      <div data-testid="current">{snapshot.current}</div>
      <div data-testid="counter">{snapshot.context.counter}</div>
      <div data-testid="terminal">{snapshot.terminal ?? "none"}</div>
    </div>
  );
};

const App = ({ flow = baseFlow }: { flow?: FlowReactFlow<Ctx, StepId, CustomEvent> }) => (
  <FlowProvider flow={flow}>
    <FlowStepRenderer<Ctx, StepId, CustomEvent> />
    <Controls />
  </FlowProvider>
);

describe("react hooks/provider edge cases", () => {
  it("next transition works through hook api", async () => {
    render(<App />);
    await act(async () => {
      screen.getByText("next").click();
    });
    expect(screen.getByTestId("current").textContent).toBe("two");
  });

  it("back uses history target", async () => {
    render(<App />);
    await act(async () => {
      screen.getByText("next").click();
    });
    await act(async () => {
      screen.getByText("back").click();
    });
    expect(screen.getByTestId("current").textContent).toBe("one");
  });

  it("close sets terminal close", async () => {
    render(<App />);
    await act(async () => {
      screen.getByText("close").click();
    });
    expect(screen.getByTestId("terminal").textContent).toBe(FLOW_TERMINAL.CLOSE);
  });

  it("submit sets terminal complete", async () => {
    render(<App />);
    await act(async () => {
      screen.getByText("next").click();
    });
    await act(async () => {
      screen.getByText("next").click();
    });
    await act(async () => {
      screen.getByText("submit").click();
    });
    expect(screen.getByTestId("terminal").textContent).toBe(FLOW_TERMINAL.COMPLETE);
  });

  it("custom event works via api.send", async () => {
    render(<App />);
    await act(async () => {
      screen.getByText("custom").click();
    });
    expect(screen.getByTestId("current").textContent).toBe("three");
  });

  it("goTo works via api.goTo", async () => {
    render(<App />);
    await act(async () => {
      screen.getByText("goto").click();
    });
    expect(screen.getByTestId("current").textContent).toBe("three");
  });

  it("updateContext updates snapshot context", async () => {
    render(<App />);
    await act(async () => {
      screen.getByText("increment").click();
    });
    expect(screen.getByTestId("counter").textContent).toBe("1");
  });

  it("reset returns to initial step", async () => {
    render(<App />);
    await act(async () => {
      screen.getByText("next").click();
    });
    await act(async () => {
      screen.getByText("reset").click();
    });
    expect(screen.getByTestId("current").textContent).toBe("one");
  });

  it("can block next with guard when context says no", async () => {
    const guardFlow: FlowReactFlow<Ctx, StepId, CustomEvent> = {
      ...baseFlow,
      context: { ...baseFlow.context, canAdvance: false }
    };
    render(<App flow={guardFlow} />);
    await act(async () => {
      screen.getByText("next").click();
    });
    expect(screen.getByTestId("current").textContent).toBe("one");
  });

  it("useFlowApi throws outside provider", () => {
    const Broken = () => {
      useFlowApi<Ctx, StepId, CustomEvent>();
      return null;
    };
    expect(() => render(<Broken />)).toThrow("useFlow*");
  });

  it("useFlowSnapshot throws outside provider", () => {
    const Broken = () => {
      useFlowSnapshot<Ctx, StepId, CustomEvent>();
      return null;
    };
    expect(() => render(<Broken />)).toThrow("useFlow*");
  });

  it("renders fallback when machine current step is unknown", () => {
    const snapshot = {
      current: "missing" as StepId,
      context: baseFlow.context,
      history: [],
      visited: ["missing" as StepId],
      terminal: null,
      isDone: false,
      async: asyncState()
    };

    const mockedMachine: FlowMachine<Ctx, StepId, "next" | "back" | "close" | "submit" | "custom"> =
      {
        getSnapshot: () => snapshot,
        send: async () => ({ transitioned: false, snapshot }),
        updateContext: () => snapshot,
        clearStepError: () => snapshot,
        reset: () => snapshot,
        subscribe: () => () => {}
      };

    render(
      <FlowProvider flow={baseFlow} machine={mockedMachine}>
        <FlowStepRenderer<Ctx, StepId, CustomEvent>
          fallback={<div data-testid="fallback">empty</div>}
        />
      </FlowProvider>
    );

    expect(screen.getByTestId("fallback")).toBeDefined();
  });

  it("passes persistence options to internal machine", async () => {
    const setItem = vi.fn();
    const storage = {
      getItem: () => null,
      setItem,
      removeItem: () => {}
    };

    render(
      <FlowProvider
        flow={baseFlow}
        persistence={{
          key: "flow",
          storage
        }}
      >
        <FlowStepRenderer<Ctx, StepId, CustomEvent> />
        <Controls />
      </FlowProvider>
    );

    await act(async () => {
      screen.getByText("next").click();
    });

    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it("sends default event payloads through hook api", async () => {
    const snapshot = {
      current: "one" as StepId,
      context: baseFlow.context,
      history: [],
      visited: ["one" as StepId],
      terminal: null,
      isDone: false,
      async: asyncState()
    };
    const send = vi.fn(async () => ({ transitioned: false, snapshot }));
    const mockedMachine: FlowMachine<Ctx, StepId, "next" | "back" | "close" | "submit" | "custom"> =
      {
        getSnapshot: () => snapshot,
        send,
        updateContext: () => snapshot,
        clearStepError: () => snapshot,
        reset: () => snapshot,
        subscribe: () => () => {}
      };

    const WithPayload = () => {
      const api = useFlowApi<Ctx, StepId, CustomEvent>();
      return (
        <button onClick={() => api.next({ reason: "manual" })} data-testid="next-payload">
          next with payload
        </button>
      );
    };

    render(
      <FlowProvider flow={baseFlow} machine={mockedMachine}>
        <WithPayload />
      </FlowProvider>
    );

    await act(async () => {
      screen.getByTestId("next-payload").click();
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ type: "next", payload: { reason: "manual" } });
  });

  it("sends goTo payloads through hook api", async () => {
    const snapshot = {
      current: "one" as StepId,
      context: baseFlow.context,
      history: [],
      visited: ["one" as StepId],
      terminal: null,
      isDone: false,
      async: asyncState()
    };
    const send = vi.fn(async () => ({ transitioned: false, snapshot }));
    const mockedMachine: FlowMachine<Ctx, StepId, "next" | "back" | "close" | "submit" | "custom"> =
      {
        getSnapshot: () => snapshot,
        send,
        updateContext: () => snapshot,
        clearStepError: () => snapshot,
        reset: () => snapshot,
        subscribe: () => () => {}
      };

    const WithGoToPayload = () => {
      const api = useFlowApi<Ctx, StepId, CustomEvent>();
      return (
        <button onClick={() => api.goTo("three", { from: "test" })} data-testid="goto-payload">
          goto with payload
        </button>
      );
    };

    render(
      <FlowProvider flow={baseFlow} machine={mockedMachine}>
        <WithGoToPayload />
      </FlowProvider>
    );

    await act(async () => {
      screen.getByTestId("goto-payload").click();
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ type: "goTo", to: "three", payload: { from: "test" } });
  });

  it("forwards clearStepError calls through hook api", async () => {
    const snapshot = {
      current: "one" as StepId,
      context: baseFlow.context,
      history: [],
      visited: ["one" as StepId],
      terminal: null,
      isDone: false,
      async: asyncState()
    };
    const clearStepError = vi.fn(() => snapshot);
    const mockedMachine: FlowMachine<Ctx, StepId, "next" | "back" | "close" | "submit" | "custom"> =
      {
        getSnapshot: () => snapshot,
        send: async () => ({ transitioned: false, snapshot }),
        updateContext: () => snapshot,
        clearStepError,
        reset: () => snapshot,
        subscribe: () => () => {}
      };

    const WithClearError = () => {
      const api = useFlowApi<Ctx, StepId, CustomEvent>();
      return (
        <button onClick={() => api.clearStepError("two")} data-testid="clear-error">
          clear error
        </button>
      );
    };

    render(
      <FlowProvider flow={baseFlow} machine={mockedMachine}>
        <WithClearError />
      </FlowProvider>
    );

    await act(async () => {
      screen.getByTestId("clear-error").click();
    });

    expect(clearStepError).toHaveBeenCalledTimes(1);
    expect(clearStepError).toHaveBeenCalledWith("two");
  });
});
