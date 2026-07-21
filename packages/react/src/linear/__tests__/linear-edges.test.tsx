import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createLinearJourney } from "@rxova/journey-react";
import { flush, makeStep } from "@rxova/journey-react/testing";
import type { LinearJourneyMachine } from "@rxova/journey-react";

const StepA = makeStep("a");
const StepB = makeStep("b");

const ab = createLinearJourney({ context: {}, steps: ["a", "b"] });

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

describe("journey.Step marker form", () => {
  it("declares the rendered content without touching the wrapped markup, with config in the definition", async () => {
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
      <journey.Provider footer={<Chrome />}>
        <journey.Step id="intro">
          <p data-testid="intro-content">hello</p>
        </journey.Step>
        <journey.Step id="second">
          <p data-testid="second-content">world</p>
        </journey.Step>
      </journey.Provider>
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

  it("throws when rendered outside the Provider or without an id", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<ab.Step id="a">nope</ab.Step>)).toThrow(/direct child/);
    expect(() =>
      render(
        <ab.Provider>
          <ab.Step id={"" as never}>missing</ab.Step>
          <StepB id="b" />
        </ab.Provider>
      )
    ).toThrow(/missing its mandatory "id"/);
    consoleError.mockRestore();
  });
});

describe("children flattening", () => {
  it("flattens fragments and skips null/boolean children", async () => {
    render(
      <ab.Provider>
        <>
          {false}
          {null}
          <StepA id="a" />
        </>
        <StepB id="b" />
      </ab.Provider>
    );
    await flush();
    expect(screen.getByTestId("step-a")).toBeTruthy();
  });

  it("rejects text children and children that vanish entirely", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<ab.Provider>just text</ab.Provider>)).toThrow(/must be step elements/);
    expect(() => render(<ab.Provider>{null}</ab.Provider>)).toThrow(/missing \[a, b\]/);
    consoleError.mockRestore();
  });

  it("describes intrinsic and anonymous components in missing-id errors", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const Anonymous = () => null;
    Object.defineProperty(Anonymous, "name", { value: undefined });

    expect(() => render(<ab.Provider>{React.createElement("div")}</ab.Provider>)).toThrow(
      /child #0 \(div\)/
    );
    expect(() => render(<ab.Provider>{React.createElement(Anonymous)}</ab.Provider>)).toThrow(
      /anonymous component/
    );
    consoleError.mockRestore();
  });
});

describe("navigation edges", () => {
  it("navigates by index, walks the timeline tip, and pauses — all through the machine", async () => {
    render(
      <ab.Provider footer={<IndexNav />}>
        <StepA id="a" />
        <StepB id="b" />
      </ab.Provider>
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

  it("starts directly at the startAt prop: earlier steps never enter or leave", async () => {
    const onLeaveA = vi.fn();
    const onError = vi.fn();
    const journey = createLinearJourney({
      context: {},
      steps: [{ id: "a", onLeave: onLeaveA }, "b"]
    });
    render(
      <journey.Provider startAt="b" onError={onError}>
        <StepA id="a" />
        <StepB id="b" />
      </journey.Provider>
    );
    await flush();

    expect(screen.getByTestId("step-b")).toBeTruthy();
    expect(onLeaveA).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("render chrome and refs", () => {
  it("clones the active step into the wrapper and supports function machineRefs", async () => {
    const seen: (LinearJourneyMachine | null)[] = [];
    const journey = createLinearJourney({ context: {}, steps: ["a"] });
    const view = render(
      <journey.Provider
        wrapper={<section data-testid="wrap" />}
        machineRef={(machine) => {
          seen.push(machine as LinearJourneyMachine | null);
        }}
      >
        <StepA id="a" />
      </journey.Provider>
    );
    await flush();
    expect(screen.getByTestId("wrap").querySelector("[data-testid='step-a']")).toBeTruthy();
    expect(seen[0]).not.toBeNull();

    view.unmount();
    await flush();
    expect(seen[seen.length - 1]).toBeNull();
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
    render(
      <journey.Provider footer={<Forward />}>
        <journey.Step id="p">
          <Passive />
        </journey.Step>
        <StepB id="b" />
      </journey.Provider>
    );
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
      <journey.Provider>
        <journey.Step id="doubled">
          <First />
          <Second />
        </journey.Step>
      </journey.Provider>
    );
    await flush();

    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('live registration for step "doubled"')
    );
    consoleWarn.mockRestore();
    delete (globalThis as { __DEV__?: boolean }).__DEV__;
  });

  it("throws outside a step component", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const Outside = () => {
      ab.useStep();
      return null;
    };
    expect(() =>
      render(
        <ab.Provider header={<Outside />}>
          <StepA id="a" />
          <StepB id="b" />
        </ab.Provider>
      )
    ).toThrow(/inside a step component/);
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
      <journey.Provider initialContext={{ n: 42 }} footer={<Forward />}>
        <journey.Step id="hooked">
          <HookedStep />
        </journey.Step>
        <StepB id="done" />
      </journey.Provider>
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
      <journey.Provider footer={<Report />}>
        <StepA id="a" />
        <journey.Step id="failing">
          <span data-testid="failing">failing</span>
        </journey.Step>
      </journey.Provider>
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
          machineRef={(machine) => {
            if (machine !== null) seen.add(machine);
          }}
        >
          <StepA id="a" />
        </journey.Provider>
      </React.StrictMode>
    );
    await flush();
    expect(seen.size).toBe(1);
    expect(screen.getByTestId("step-a")).toBeTruthy();
    view.unmount();
    await flush();
  });
});
