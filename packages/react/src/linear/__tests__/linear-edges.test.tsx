import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  createLinearJourney,
  useLinearJourney,
  useLinearJourneyStep,
  LinearJourney,
  LinearJourneyStep
} from "@rxova/journey-react";
import { flush, makeStep, memoryStorage } from "@rxova/journey-react/testing";
import type { LinearJourneyMachine } from "@rxova/journey-react";

const StepA = makeStep("a");
const StepB = makeStep("b");

const IndexNav = () => {
  const { machine, snapshot } = useLinearJourney();
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

describe("<LinearJourney.Step> children form", () => {
  it("declares config without touching the wrapped markup and runs its hooks", async () => {
    const onEnter = vi.fn();
    render(
      <LinearJourney footer={<IndexNav />}>
        <LinearJourney.Step id="intro" metadata="Intro metadata">
          <p data-testid="intro-content">hello</p>
        </LinearJourney.Step>
        <LinearJourney.Step id="second" onEnter={onEnter} onLeave={() => undefined}>
          <p data-testid="second-content">world</p>
        </LinearJourney.Step>
      </LinearJourney>
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
  });

  it("throws when rendered outside <LinearJourney> or without an id", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<LinearJourneyStep id="x">nope</LinearJourneyStep>)).toThrow(
      /direct child/
    );
    expect(() =>
      render(
        <LinearJourney>
          <LinearJourney.Step id="">missing</LinearJourney.Step>
        </LinearJourney>
      )
    ).toThrow(/missing its mandatory "id"/);
    consoleError.mockRestore();
  });
});

describe("children flattening", () => {
  it("flattens fragments and skips null/boolean children", async () => {
    render(
      <LinearJourney>
        <>
          {false}
          {null}
          <StepA id="a" />
        </>
        <StepB id="b" />
      </LinearJourney>
    );
    await flush();
    expect(screen.getByTestId("step-a")).toBeTruthy();
  });

  it("rejects text children and empty step sets", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<LinearJourney>just text</LinearJourney>)).toThrow(/must be step elements/);
    expect(() => render(<LinearJourney>{null}</LinearJourney>)).toThrow(/at least one step/);
    consoleError.mockRestore();
  });

  it("describes intrinsic and anonymous components in missing-id errors", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const Anonymous = () => null;
    Object.defineProperty(Anonymous, "name", { value: undefined });

    expect(() => render(<LinearJourney>{React.createElement("div")}</LinearJourney>)).toThrow(
      /child #0 \(div\)/
    );
    expect(() => render(<LinearJourney>{React.createElement(Anonymous)}</LinearJourney>)).toThrow(
      /anonymous component/
    );
    consoleError.mockRestore();
  });
});

describe("navigation edges", () => {
  it("navigates by index, walks the timeline tip, and pauses — all through the machine", async () => {
    render(
      <LinearJourney footer={<IndexNav />}>
        <StepA id="a" />
        <StepB id="b" />
      </LinearJourney>
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

  it("starts directly at options.startAt: earlier steps never enter or leave", async () => {
    const onLeaveA = vi.fn();
    const onError = vi.fn();
    render(
      <LinearJourney options={{ startAt: "b" }} onError={onError}>
        <LinearJourney.Step id="a" onLeave={onLeaveA}>
          <StepA />
        </LinearJourney.Step>
        <StepB id="b" />
      </LinearJourney>
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
    const view = render(
      <LinearJourney
        wrapper={<section data-testid="wrap" />}
        machineRef={(machine) => {
          seen.push(machine as LinearJourneyMachine | null);
        }}
      >
        <StepA id="a" />
      </LinearJourney>
    );
    await flush();
    expect(screen.getByTestId("wrap").querySelector("[data-testid='step-a']")).toBeTruthy();
    expect(seen[0]).not.toBeNull();

    view.unmount();
    await flush();
    expect(seen[seen.length - 1]).toBeNull();
  });

  it("renders fallback when a rerender removes the machine's active step", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = render(
      <LinearJourney fallback={<span data-testid="fallback">fallback</span>} footer={<IndexNav />}>
        <StepA id="a" />
        <StepB id="b" />
      </LinearJourney>
    );
    await flush();
    fireEvent.click(screen.getByText("by-index"));
    await flush();

    view.rerender(
      <LinearJourney fallback={<span data-testid="fallback">fallback</span>} footer={<IndexNav />}>
        <StepA id="a" />
      </LinearJourney>
    );
    await flush();

    expect(screen.getByTestId("fallback")).toBeTruthy();
    consoleError.mockRestore();
  });
});

describe("createLinearJourney extras", () => {
  it("threads options (startAt, persist, plugins) through the typed component", async () => {
    const storage = memoryStorage();
    const journey = createLinearJourney<{ n: number }>()(["one", "two"]);

    const Forward = () => {
      const { machine } = journey.useLinearJourney();
      return <button onClick={() => void machine.navigate.goToPreviousStep()}>rewind</button>;
    };

    render(
      <journey.LinearJourney
        context={{ n: 0 }}
        options={{ startAt: "two", persist: { key: "bundle", storage }, plugins: [] }}
        footer={<Forward />}
      >
        <StepA id="one" />
        <StepB id="two" />
      </journey.LinearJourney>
    );
    await flush();
    expect(screen.getByTestId("step-b")).toBeTruthy();
    expect(storage.dump().has("bundle")).toBe(true);

    // startAt starts directly at "two": there is no earlier timeline entry.
    fireEvent.click(screen.getByText("rewind"));
    await flush();
    expect(screen.getByTestId("step-b")).toBeTruthy();
  });

  it("registers no-op handlers without breaking forward navigation", async () => {
    const Passive = () => {
      useLinearJourneyStep(); // no handler
      return <span data-testid="passive">passive</span>;
    };
    const Forward = () => {
      const { machine } = useLinearJourney();
      return <button onClick={() => void machine.navigate.goToNextStep()}>go</button>;
    };
    render(
      <LinearJourney footer={<Forward />}>
        <LinearJourney.Step id="p">
          <Passive />
        </LinearJourney.Step>
        <StepB id="b" />
      </LinearJourney>
    );
    await flush();
    fireEvent.click(screen.getByText("go"));
    await flush();
    expect(screen.getByTestId("step-b")).toBeTruthy();
  });

  it("warns in dev when two mounted components register work for the same step", async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const First = () => {
      useLinearJourneyStep({ run: () => undefined });
      return <span>first</span>;
    };
    const Second = () => {
      useLinearJourneyStep({ run: () => undefined });
      return <span>second</span>;
    };
    render(
      <LinearJourney>
        <LinearJourney.Step id="doubled">
          <First />
          <Second />
        </LinearJourney.Step>
      </LinearJourney>
    );
    await flush();

    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('live registration for step "doubled"')
    );
    consoleWarn.mockRestore();
    delete (globalThis as { __DEV__?: boolean }).__DEV__;
  });

  it("useLinearJourneyStep outside a step component throws", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const Outside = () => {
      useLinearJourneyStep();
      return null;
    };
    expect(() =>
      render(
        <LinearJourney header={<Outside />}>
          <StepA id="a" />
        </LinearJourney>
      )
    ).toThrow(/inside a step component/);
    consoleError.mockRestore();
  });
});

describe("machine error surfacing", () => {
  it("exposes a step onEnter error through the snapshot's async state", async () => {
    const Failing = () => <span data-testid="failing">failing</span>;
    const Report = () => {
      const { machine, snapshot } = useLinearJourney();
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
      <LinearJourney footer={<Report />}>
        <StepA id="a" />
        <LinearJourney.Step
          id="failing"
          onEnter={() => {
            throw new Error("enter exploded");
          }}
        >
          <Failing />
        </LinearJourney.Step>
      </LinearJourney>
    );
    await flush();
    expect(screen.getByTestId("machine-error").textContent).toBe("none");

    fireEvent.click(screen.getByText("advance"));
    await flush();
    expect(screen.getByTestId("machine-error").textContent).toContain("enter exploded");
  });

  it("survives a StrictMode mount/unmount cycle with one machine", async () => {
    const seen = new Set<unknown>();
    const view = render(
      <React.StrictMode>
        <LinearJourney
          machineRef={(machine) => {
            if (machine !== null) seen.add(machine);
          }}
        >
          <StepA id="a" />
        </LinearJourney>
      </React.StrictMode>
    );
    await flush();
    expect(seen.size).toBe(1);
    expect(screen.getByTestId("step-a")).toBeTruthy();
    view.unmount();
    await flush();
  });
});

describe("typed bundle step hooks", () => {
  it("runs bundle step handlers with the render-time context", async () => {
    const handler = { run: vi.fn() };
    const journey = createLinearJourney<{ n: number }>()(["hooked", "done"]);
    const HookedStep = () => {
      journey.useLinearJourneyStep(handler);
      const { snapshot } = journey.useLinearJourney();
      return <span data-testid="ctx">{snapshot.context.n}</span>;
    };
    const Forward = () => {
      const { machine } = journey.useLinearJourney();
      return <button onClick={() => void machine.navigate.goToNextStep()}>onward</button>;
    };

    render(
      <journey.LinearJourney context={{ n: 42 }} footer={<Forward />}>
        <journey.LinearJourney.Step id="hooked">
          <HookedStep />
        </journey.LinearJourney.Step>
        <StepB id="done" />
      </journey.LinearJourney>
    );
    await flush();
    expect(screen.getByTestId("ctx").textContent).toBe("42");

    fireEvent.click(screen.getByText("onward"));
    await flush();
    expect(handler.run).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("step-b")).toBeTruthy();
  });
});
