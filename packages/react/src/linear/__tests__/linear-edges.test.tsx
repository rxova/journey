import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createLinearJourney } from "@rxova/journey-react";
import { flush, makeStep } from "@rxova/journey-react/testing";
import type { LinearJourneyMachine } from "@rxova/journey-react";

const StepA = makeStep("a");
const StepB = makeStep("b");

const ab = createLinearJourney({ context: {}, steps: ["a", "b"] });
const abViews = { a: <StepA />, b: <StepB /> };

const IndexNav = () => {
  const { machine, snapshot } = ab.useJourney();
  return (
    <div>
      <span data-testid="active">{snapshot.currentStep.id}</span>
      <span data-testid="paused">{snapshot.machine.isPaused ? "paused" : "running"}</span>
      <button onClick={() => void machine.navigate.goToStepByIndex(1)}>by-index</button>
      <button onClick={() => void machine.navigate.goToLastVisitedStep()}>tip</button>
      <button onClick={() => void machine.navigate.goToPreviousStep()}>back</button>
      <button onClick={() => machine.controls.pause()}>pause</button>
    </div>
  );
};

describe("definition step config", () => {
  it("runs definition onEnter/onLeave hooks while views only render", async () => {
    const onEnter = vi.fn();
    const onLeave = vi.fn();
    const journey = createLinearJourney({
      context: {},
      steps: [
        { id: "intro", metadata: "Intro metadata" },
        { id: "second", onEnter, onLeave }
      ]
    });
    const Chrome = () => {
      const { machine } = journey.useJourney();
      return (
        <div>
          <button onClick={() => void machine.navigate.goToStepByIndex(1)}>by-index</button>
          <button onClick={() => void machine.navigate.goToPreviousStep()}>back</button>
        </div>
      );
    };
    render(
      <journey.Provider
        views={{
          intro: <p data-testid="intro-content">hello</p>,
          second: <p data-testid="second-content">world</p>
        }}
        footer={<Chrome />}
      />
    );
    await flush();
    expect(screen.getByTestId("intro-content")).toBeTruthy();

    fireEvent.click(screen.getByText("by-index"));
    await flush();
    expect(screen.getByTestId("second-content")).toBeTruthy();
    expect(onEnter).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("back")); // second's onLeave runs on the way out
    await flush();
    expect(screen.getByTestId("intro-content")).toBeTruthy();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});

describe("navigation edges", () => {
  it("navigates by index, walks the timeline tip, and pauses — all through the machine", async () => {
    render(<ab.Provider views={abViews} footer={<IndexNav />} />);
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

  it("starts directly at the startAt prop: earlier steps never enter or leave", async () => {
    const onLeaveA = vi.fn();
    const onError = vi.fn();
    const journey = createLinearJourney({
      context: {},
      steps: [{ id: "a", onLeave: onLeaveA }, "b"]
    });
    render(
      <journey.Provider views={{ a: <StepA />, b: <StepB /> }} startAt="b" onError={onError} />
    );
    await flush();

    expect(screen.getByTestId("step-b")).toBeTruthy();
    expect(onLeaveA).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("render chrome and refs", () => {
  it("clones the active view into the wrapper and supports function machineRefs", async () => {
    const seen: (LinearJourneyMachine | null)[] = [];
    const journey = createLinearJourney({ context: {}, steps: ["a"] });
    const view = render(
      <journey.Provider
        views={{ a: <StepA /> }}
        wrapper={<section data-testid="wrap" />}
        machineRef={(machine) => {
          seen.push(machine as LinearJourneyMachine | null);
        }}
      />
    );
    await flush();
    expect(screen.getByTestId("wrap").querySelector("[data-testid='step-a']")).toBeTruthy();
    expect(seen[0]).not.toBeNull();

    view.unmount();
    await flush();
    expect(seen[seen.length - 1]).toBeNull();
  });

  it("remounts the view when the step changes (keyed by id)", async () => {
    const mounts = vi.fn();
    const Counting = ({ label }: { label: string }) => {
      React.useEffect(() => {
        mounts(label);
      }, [label]);
      return <span data-testid={`step-${label}`}>{label}</span>;
    };
    render(
      <ab.Provider
        views={{ a: <Counting label="a" />, b: <Counting label="b" /> }}
        footer={<IndexNav />}
      />
    );
    await flush();
    fireEvent.click(screen.getByText("by-index"));
    await flush();
    fireEvent.click(screen.getByText("back"));
    await flush();
    // a mounted twice (fresh + revisit), b once: views remount per entry.
    expect(mounts.mock.calls.map(([label]) => label)).toEqual(["a", "b", "a"]);
  });
});

describe("useStep extras", () => {
  it("registers no-op handlers without breaking forward navigation", async () => {
    const journey = createLinearJourney({ context: {}, steps: ["p", "b"] });
    const Passive = () => {
      journey.useStep(); // no handler
      return <span data-testid="passive">passive</span>;
    };
    const Forward = () => {
      const { machine } = journey.useJourney();
      return <button onClick={() => void machine.navigate.goToNextStep()}>go</button>;
    };
    render(<journey.Provider views={{ p: <Passive />, b: <StepB /> }} footer={<Forward />} />);
    await flush();
    fireEvent.click(screen.getByText("go"));
    await flush();
    expect(screen.getByTestId("step-b")).toBeTruthy();
  });

  it("warns in dev when two mounted components register work for the same step", async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const journey = createLinearJourney({ context: {}, steps: ["doubled"] });
    const First = () => {
      journey.useStep({ run: () => undefined });
      return <span>first</span>;
    };
    const Second = () => {
      journey.useStep({ run: () => undefined });
      return <span>second</span>;
    };
    render(
      <journey.Provider
        views={{
          doubled: (
            <>
              <First />
              <Second />
            </>
          )
        }}
      />
    );
    await flush();

    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('live registration for step "doubled"')
    );
    consoleWarn.mockRestore();
    delete (globalThis as { __DEV__?: boolean }).__DEV__;
  });

  it("throws outside a step view", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const Outside = () => {
      ab.useStep();
      return null;
    };
    expect(() => render(<ab.Provider views={abViews} header={<Outside />} />)).toThrow(
      /inside a step/
    );
    consoleError.mockRestore();
  });

  it("runs bundle step handlers with the mount-time context override", async () => {
    const handler = { run: vi.fn() };
    const journey = createLinearJourney({ context: { n: 0 }, steps: ["hooked", "done"] });
    const HookedStep = () => {
      journey.useStep(handler);
      const { snapshot } = journey.useJourney();
      return <span data-testid="ctx">{snapshot.context.n}</span>;
    };
    const Forward = () => {
      const { machine } = journey.useJourney();
      return <button onClick={() => void machine.navigate.goToNextStep()}>onward</button>;
    };

    render(
      <journey.Provider
        views={{ hooked: <HookedStep />, done: <StepB /> }}
        initialContext={{ n: 42 }}
        footer={<Forward />}
      />
    );
    await flush();
    expect(screen.getByTestId("ctx").textContent).toBe("42");

    fireEvent.click(screen.getByText("onward"));
    await flush();
    expect(handler.run).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("step-b")).toBeTruthy();
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
      const { machine, snapshot } = journey.useJourney();
      return (
        <div>
          <span data-testid="machine-error">
            {String(snapshot.currentStep.async.error ?? "none")}
          </span>
          <button onClick={() => void machine.navigate.goToNextStep()}>advance</button>
        </div>
      );
    };
    render(
      <journey.Provider
        views={{ a: <StepA />, failing: <span data-testid="failing">failing</span> }}
        footer={<Report />}
      />
    );
    await flush();
    expect(screen.getByTestId("machine-error").textContent).toBe("none");

    fireEvent.click(screen.getByText("advance"));
    await flush();
    expect(screen.getByTestId("machine-error").textContent).toContain("enter exploded");
  });

  it("survives a StrictMode mount/unmount cycle with one machine", async () => {
    const seen = new Set<unknown>();
    const journey = createLinearJourney({ context: {}, steps: ["a"] });
    const view = render(
      <React.StrictMode>
        <journey.Provider
          views={{ a: <StepA /> }}
          machineRef={(machine) => {
            if (machine !== null) seen.add(machine);
          }}
        />
      </React.StrictMode>
    );
    await flush();
    expect(seen.size).toBe(1);
    expect(screen.getByTestId("step-a")).toBeTruthy();
    view.unmount();
    await flush();
  });
});
