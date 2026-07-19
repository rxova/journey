import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { createLinearJourney } from "@rxova/journey-core";
import {
  useJourneyEvent,
  useJourneySelector,
  useJourneySnapshot,
  useJourneyStepLifecycle,
  useOwnedJourney,
  useStepAsyncState
} from "@rxova/journey-react/headless";
import { flush } from "@rxova/journey-react/testing";

const makeMachine = () =>
  createLinearJourney({ steps: ["a", "b", "c"], context: { n: 0 } }, { autoStart: true });

type Machine = ReturnType<typeof makeMachine>;

describe("useOwnedJourney", () => {
  it("creates the machine once under StrictMode and disposes on unmount", async () => {
    const factory = vi.fn(makeMachine);
    let owned: Machine | null = null;

    const Owner = () => {
      owned = useOwnedJourney(factory);
      return <span>owned</span>;
    };

    const view = render(
      <React.StrictMode>
        <Owner />
      </React.StrictMode>
    );
    await flush();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(owned!.getSnapshot().status).toBe("running");

    view.unmount();
    await flush();
    // disposed machines are safe no-ops
    expect(await owned!.navigate.goToNextStep()).toEqual({ ok: false, reason: "disposed" });
  });
});

describe("useJourneySnapshot / useJourneySelector", () => {
  it("re-renders on navigation and exposes the live snapshot", async () => {
    const machine = makeMachine();
    const Probe = () => {
      const snapshot = useJourneySnapshot(machine);
      return <span data-testid="current">{snapshot.currentStep?.id}</span>;
    };
    render(<Probe />);
    await flush();
    expect(screen.getByTestId("current").textContent).toBe("a");

    await act(async () => {
      await machine.navigate.goToNextStep();
    });
    expect(screen.getByTestId("current").textContent).toBe("b");
  });

  it("selector subscribers only re-render when the selected value changes", async () => {
    const machine = makeMachine();
    const renders = vi.fn();
    const Probe = () => {
      const id = useJourneySelector(machine, (snapshot) => snapshot.currentStep?.id);
      renders(id);
      return <span>{id}</span>;
    };
    render(<Probe />);
    const before = renders.mock.calls.length;

    await act(async () => {
      machine.context.update((c) => ({ n: c.n + 1 })); // id unchanged
    });
    expect(renders.mock.calls.length).toBe(before);

    await act(async () => {
      await machine.navigate.goToNextStep();
    });
    expect(renders).toHaveBeenLastCalledWith("b");
  });
});

describe("useJourneySelector cache", () => {
  it("reuses the cached selection when a custom equality declares it unchanged", async () => {
    const machine = makeMachine();
    const seen: unknown[] = [];
    // cache reuse requires stable selector/equality references across renders
    const idSelector = (snapshot: ReturnType<typeof machine.getSnapshot>) =>
      snapshot.currentStep?.id;
    const kindSelector = (snapshot: ReturnType<typeof machine.getSnapshot>) => ({
      kind: snapshot.type
    });
    const kindEquals = (a: { kind: string }, b: { kind: string }) => a.kind === b.kind;
    const Probe = () => {
      // first hook re-renders the component on every step change
      const id = useJourneySelector(machine, idSelector);
      // second hook returns fresh objects that the custom equality collapses
      const stable = useJourneySelector(machine, kindSelector, kindEquals);
      seen.push(stable);
      return <span>{id}</span>;
    };
    render(<Probe />);
    await flush();

    await act(async () => {
      await machine.navigate.goToNextStep();
    });
    expect(seen.length).toBeGreaterThan(1);
    // same object identity across re-renders: the cache reused the selection
    expect(new Set(seen).size).toBe(1);
  });

  it("keeps one machine subscription across re-renders with inline selectors", async () => {
    const machine = makeMachine();
    const subscribeSpy = vi.spyOn(machine.subscriptions, "subscribeSelector");

    const Probe = ({ label }: { label: string }) => {
      // inline selector + inline equality: new identities every render
      const id = useJourneySelector(
        machine,
        (snapshot) => snapshot.currentStep?.id,
        (a, b) => a === b
      );
      return (
        <span>
          {label}:{id}
        </span>
      );
    };

    const view = render(<Probe label="one" />);
    await flush();
    view.rerender(<Probe label="two" />);
    view.rerender(<Probe label="three" />);
    await flush();

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
  });

  it("re-runs a props-dependent selector on the render that changes it", async () => {
    const machine = makeMachine();
    const Probe = ({ index }: { index: number }) => {
      const id = useJourneySelector(machine, (snapshot) => snapshot.steps.stepOrder[index]);
      return <span data-testid="picked">{id}</span>;
    };

    const view = render(<Probe index={0} />);
    await flush();
    expect(screen.getByTestId("picked").textContent).toBe("a");

    view.rerender(<Probe index={2} />);
    expect(screen.getByTestId("picked").textContent).toBe("c");
  });
});

describe("useJourneyEvent / useJourneyStepLifecycle / useStepAsyncState", () => {
  it("delivers subscription events and step lifecycle callbacks", async () => {
    const machine = makeMachine();
    const entered: string[] = [];
    const lifecycle = { enter: vi.fn(), leave: vi.fn() };

    const Probe = () => {
      useJourneyEvent(machine, "stepEnter", ({ to }) => entered.push(to));
      useJourneyStepLifecycle(machine, "b", {
        onEnter: lifecycle.enter,
        onLeave: lifecycle.leave
      });
      return null;
    };
    render(<Probe />);
    await flush();

    await act(async () => {
      await machine.navigate.goToNextStep();
      await machine.navigate.goToNextStep();
    });

    expect(entered).toEqual(["b", "c"]);
    expect(lifecycle.enter).toHaveBeenCalledWith({ context: { n: 0 } });
    expect(lifecycle.leave).toHaveBeenCalledTimes(1);
  });

  it("reports the current step's async state and idle for the rest", async () => {
    const machine = createLinearJourney(
      {
        steps: [
          "a",
          {
            id: "b",
            onEnter: () => {
              throw new Error("enter failed");
            }
          }
        ],
        context: {}
      },
      { autoStart: true }
    );
    const Probe = ({ stepId }: { stepId: "a" | "b" }) => {
      const state = useStepAsyncState(machine, stepId);
      let label = "idle";
      if (state.isError) label = "error";
      else if (state.isSuccess) label = "success";
      return <span data-testid={`async-${stepId}`}>{label}</span>;
    };
    render(
      <>
        <Probe stepId="a" />
        <Probe stepId="b" />
      </>
    );
    await flush();
    expect(screen.getByTestId("async-a").textContent).toBe("success");
    expect(screen.getByTestId("async-b").textContent).toBe("idle");

    await act(async () => {
      await machine.navigate.goToNextStep();
    });
    expect(screen.getByTestId("async-a").textContent).toBe("idle");
    expect(screen.getByTestId("async-b").textContent).toBe("error");
  });
});

describe("concurrent rendering", () => {
  it("never tears: two subscribers observe the same step within every commit", async () => {
    const machine = makeMachine();
    const observed: { a: string | undefined; b: string | undefined }[] = [];
    let currentA: string | undefined;
    const A = () => {
      currentA = useJourneySelector(machine, (snapshot) => snapshot.currentStep?.id);
      return <span>{currentA}</span>;
    };
    const B = () => {
      const b = useJourneySelector(machine, (snapshot) => snapshot.currentStep?.id);
      observed.push({ a: currentA, b });
      return <span>{b}</span>;
    };
    render(
      <>
        <A />
        <B />
      </>
    );
    await flush();

    await act(async () => {
      React.startTransition(() => {
        void machine.navigate.goToNextStep();
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      React.startTransition(() => {
        void machine.navigate.goToNextStep();
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(observed.length).toBeGreaterThanOrEqual(2);
    for (const pair of observed) {
      expect(pair.a).toBe(pair.b);
    }
    expect(machine.getSnapshot().currentStep?.id).toBe("c");
  });

  it("navigation triggered inside startTransition lands and renders", async () => {
    const machine = makeMachine();
    const Probe = () => {
      const id = useJourneySelector(machine, (snapshot) => snapshot.currentStep?.id);
      return <span data-testid="current">{id}</span>;
    };
    render(<Probe />);
    await flush();

    await act(async () => {
      React.startTransition(() => {
        void machine.navigate.goToStepById("c");
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByTestId("current").textContent).toBe("c");
  });
});
