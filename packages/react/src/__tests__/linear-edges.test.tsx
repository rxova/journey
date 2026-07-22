import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createLinearJourney } from "@rxova/journey-react";
import { flush, makeStep } from "@rxova/journey-react/testing";

const StepA = makeStep("a");
const StepB = makeStep("b");

describe("navigation edges", () => {
  it("navigates by index, walks the timeline tip, and pauses — all through the machine", async () => {
    const journey = createLinearJourney({ context: {}, steps: ["a", "b"] });
    const IndexNav = () => {
      const step = journey.useStep();
      const paused = journey.useSelector((snapshot) => snapshot.machine.isPaused);
      const navigate = journey.useNavigation();
      const controls = journey.useControls();
      return (
        <div>
          <span data-testid="active">{step?.id}</span>
          <span data-testid="paused">{paused ? "paused" : "running"}</span>
          <button onClick={() => void navigate.goToStepByIndex(1)}>by-index</button>
          <button onClick={() => void navigate.goToLastVisitedStep()}>tip</button>
          <button onClick={() => void navigate.goToPreviousStep()}>back</button>
          <button onClick={() => controls.pause()}>pause</button>
        </div>
      );
    };
    render(
      <journey.Provider views={{ a: <StepA />, b: <StepB /> }}>
        <journey.StepRenderer />
        <IndexNav />
      </journey.Provider>
    );
    await flush();

    fireEvent.click(screen.getByText("by-index"));
    await flush();
    expect(screen.getByTestId("active").textContent).toBe("b");

    fireEvent.click(screen.getByText("back"));
    await flush();
    expect(screen.getByTestId("active").textContent).toBe("a");
    fireEvent.click(screen.getByText("tip"));
    await flush();
    expect(screen.getByTestId("active").textContent).toBe("b");

    fireEvent.click(screen.getByText("pause"));
    await flush();
    expect(screen.getByTestId("paused").textContent).toBe("paused");
  });
});

describe("render chrome", () => {
  it("places StepRenderer among ordinary siblings and remounts views per entry", async () => {
    const journey = createLinearJourney({ context: {}, steps: ["a", "b"] });
    const mounts = vi.fn();
    const Counting = ({ label }: { label: string }) => {
      React.useEffect(() => {
        mounts(label);
      }, [label]);
      return <span data-testid={`step-${label}`}>{label}</span>;
    };
    render(
      <journey.Provider views={{ a: <Counting label="a" />, b: <Counting label="b" /> }}>
        <header data-testid="head">header</header>
        <journey.StepRenderer />
        <footer data-testid="foot">footer</footer>
      </journey.Provider>
    );
    await flush();
    expect(screen.getByTestId("head")).toBeTruthy();
    expect(screen.getByTestId("foot")).toBeTruthy();

    await act(async () => {
      await journey.navigate.goToNextStep();
    });
    await act(async () => {
      await journey.navigate.goToPreviousStep();
    });
    // a mounted twice (fresh + revisit), b once: views remount per entry.
    expect(mounts.mock.calls.map(([label]) => label)).toEqual(["a", "b", "a"]);
  });

  it("selector equality collapses derived-object churn", async () => {
    const journey = createLinearJourney({ context: { attempts: 0 }, steps: ["a"] });
    const seen: unknown[] = [];
    const kindSelector = (snapshot: { context: { attempts: number } }) => ({
      attempts: snapshot.context.attempts
    });
    const closeEnough = (a: { attempts: number }, b: { attempts: number }) =>
      Math.abs(a.attempts - b.attempts) < 10;
    const Probe = () => {
      const stable = journey.useSelector(kindSelector as never, closeEnough as never);
      seen.push(stable);
      return (
        <button onClick={() => journey.updateContext((c) => ({ attempts: c.attempts + 1 }))}>
          bump
        </button>
      );
    };
    render(<Probe />);
    await flush();

    fireEvent.click(screen.getByText("bump"));
    await flush();
    const observed = new Set(seen.map((value) => JSON.stringify(value)));
    expect(observed.size).toBe(1); // equality collapsed the +1 change
  });

  it("keeps the selected reference stable across parent re-renders with an inline selector", async () => {
    const journey = createLinearJourney({ context: { attempts: 0 }, steps: ["a"] });
    const seen: unknown[] = [];
    const Probe = ({ tick }: { tick: number }) => {
      const slice = journey.useSelector(
        (snapshot) => ({ attempts: snapshot.context.attempts }),
        (a, b) => a.attempts === b.attempts
      );
      seen.push(slice);
      return <span data-testid="tick">{tick}</span>;
    };
    const view = render(<Probe tick={0} />);
    await flush();
    view.rerender(<Probe tick={1} />);
    view.rerender(<Probe tick={2} />);
    // The selector is a fresh closure every render; equalityFn must still
    // collapse equal slices to the previously selected reference.
    expect(new Set(seen).size).toBe(1);
  });

  it("bails out of re-renders when equalityFn reports the slice unchanged", async () => {
    const journey = createLinearJourney({ context: { attempts: 0 }, steps: ["a"] });
    let renders = 0;
    const Probe = () => {
      renders += 1;
      journey.useSelector(
        (snapshot) => ({ bucket: Math.floor(snapshot.context.attempts / 10) }),
        (a, b) => a.bucket === b.bucket
      );
      return null;
    };
    render(<Probe />);
    await flush();
    const before = renders;
    await act(async () => {
      journey.updateContext((c) => ({ attempts: c.attempts + 1 }));
    });
    expect(renders).toBe(before); // same bucket → no re-render
  });

  it("command groups are stable machine properties across re-renders", async () => {
    const journey = createLinearJourney({ context: { n: 0 }, steps: ["a"] });
    const controlsSeen = new Set<unknown>();
    const navigationSeen = new Set<unknown>();
    const Probe = () => {
      controlsSeen.add(journey.useControls());
      navigationSeen.add(journey.useNavigation());
      const n = journey.useSelector((snapshot) => snapshot.context.n);
      return <span data-testid="n">{n}</span>;
    };
    render(<Probe />);
    await flush();
    await act(async () => {
      journey.updateContext((c) => ({ n: c.n + 1 }));
    });
    await act(async () => {
      journey.updateContext((c) => ({ n: c.n + 1 }));
    });

    expect(screen.getByTestId("n").textContent).toBe("2");
    expect(controlsSeen.size).toBe(1);
    expect(navigationSeen.size).toBe(1);
  });
});

describe("subscription lifecycle", () => {
  it("stops delivering events after the subscribing component unmounts", async () => {
    const journey = createLinearJourney({ context: {}, steps: ["a", "b", "c"] });
    const entered: string[] = [];
    const Probe = () => {
      journey.useSubscribeEvent("stepEnter", ({ to }) => entered.push(to));
      return null;
    };
    const view = render(<Probe />);
    await flush();
    await act(async () => {
      await journey.navigate.goToNextStep();
    });
    const delivered = entered.length;
    expect(delivered).toBeGreaterThan(0);

    view.unmount();
    await act(async () => {
      await journey.navigate.goToNextStep();
    });
    expect(entered.length).toBe(delivered);
  });

  it("resubscribes when the event name changes between renders", async () => {
    const journey = createLinearJourney({ context: { n: 0 }, steps: ["a", "b"] });
    const delivered: string[] = [];
    const Probe = ({ event }: { event: "stepEnter" | "contextChange" }) => {
      journey.useSubscribeEvent(event, () => delivered.push(event));
      return null;
    };
    const view = render(<Probe event="stepEnter" />);
    await flush();
    view.rerender(<Probe event="contextChange" />);
    await act(async () => {
      await journey.navigate.goToNextStep(); // stepEnter no longer subscribed
    });
    expect(delivered.filter((event) => event === "stepEnter")).toEqual([]);

    await act(async () => {
      journey.updateContext((c) => ({ n: c.n + 1 }));
    });
    expect(delivered).toContain("contextChange");
  });

  it("moves the step-handler registration when the stepId argument changes", async () => {
    const journey = createLinearJourney({ context: {}, steps: ["a", "b", "c"] });
    const Probe = ({ gated }: { gated: "a" | "b" }) => {
      journey.useStepHandler(gated, {
        run: () => {
          throw new Error(`blocked on ${gated}`);
        }
      });
      return null;
    };
    const view = render(<Probe gated="b" />);
    await flush();
    await act(async () => {
      await journey.navigate.goToNextStep(); // "a" is not gated
    });
    expect(journey.machine.getSnapshot().currentStep?.id).toBe("b");

    view.rerender(<Probe gated="a" />);
    await flush();
    await act(async () => {
      await journey.navigate.goToNextStep(); // "b" is no longer gated
    });
    expect(journey.machine.getSnapshot().currentStep?.id).toBe("c");
  });

  it("isolates component-owned bundles created with a useState lazy initializer", async () => {
    const Wizard = ({ marker }: { marker: string }) => {
      const [journey] = React.useState(() =>
        createLinearJourney({ context: {}, steps: ["a", "b"] })
      );
      const step = journey.useStep();
      return (
        <div>
          <span data-testid={`owned-${marker}`}>{step?.id}</span>
          <button onClick={() => void journey.navigate.goToNextStep()}>{`next-${marker}`}</button>
        </div>
      );
    };
    render(
      <React.StrictMode>
        <Wizard marker="one" />
        <Wizard marker="two" />
      </React.StrictMode>
    );
    await flush();

    fireEvent.click(screen.getByText("next-one"));
    await flush();
    expect(screen.getByTestId("owned-one").textContent).toBe("b");
    expect(screen.getByTestId("owned-two").textContent).toBe("a"); // per-instance machine
  });

  it("re-renders the active view when the Provider receives a new views object", async () => {
    const journey = createLinearJourney({ context: {}, steps: ["a"] });
    const Shell = ({ label }: { label: string }) => (
      <journey.Provider views={{ a: <span data-testid="view">{label}</span> }}>
        <journey.StepRenderer />
      </journey.Provider>
    );
    const view = render(<Shell label="one" />);
    await flush();
    expect(screen.getByTestId("view").textContent).toBe("one");

    view.rerender(<Shell label="two" />);
    expect(screen.getByTestId("view").textContent).toBe("two");
  });
});

describe("machine error surfacing", () => {
  it("exposes a definition onEnter error through the snapshot's async state", async () => {
    const journey = createLinearJourney({
      context: {},
      steps: [
        "a",
        {
          id: "failing",
          onEnter: () => {
            throw new Error("enter exploded");
          }
        }
      ]
    });
    const Report = () => {
      const step = journey.useStep();
      return <span data-testid="machine-error">{String(step?.async.error ?? "none")}</span>;
    };
    render(
      <journey.Provider
        views={{ a: <StepA />, failing: <span data-testid="failing">failing</span> }}
      >
        <journey.StepRenderer />
        <Report />
      </journey.Provider>
    );
    await flush();
    expect(screen.getByTestId("machine-error").textContent).toBe("none");

    await act(async () => {
      await journey.navigate.goToNextStep();
    });
    expect(screen.getByTestId("machine-error").textContent).toContain("enter exploded");
  });

  it("warns in dev when two mounted components register work for the same step", async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const journey = createLinearJourney({ context: {}, steps: ["doubled"] });
    const First = () => {
      journey.useStepHandler("doubled", { run: () => undefined });
      return <span>first</span>;
    };
    const Second = () => {
      journey.useStepHandler("doubled", { run: () => undefined });
      return <span>second</span>;
    };
    render(
      <>
        <First />
        <Second />
      </>
    );
    await flush();

    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('live registration for step "doubled"')
    );
    consoleWarn.mockRestore();
    delete (globalThis as { __DEV__?: boolean }).__DEV__;
  });

  it("renders under StrictMode against the one standalone machine", async () => {
    const journey = createLinearJourney({ context: {}, steps: ["a", "b"] });
    render(
      <React.StrictMode>
        <journey.Provider views={{ a: <StepA />, b: <StepB /> }}>
          <journey.StepRenderer />
        </journey.Provider>
      </React.StrictMode>
    );
    await flush();
    expect(screen.getByTestId("step-a")).toBeTruthy();

    await act(async () => {
      await journey.navigate.goToNextStep();
    });
    expect(screen.getByTestId("step-b")).toBeTruthy();
  });
});
