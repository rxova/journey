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
  const journey = useLinearJourney();
  return (
    <div>
      <span data-testid="active">{journey.activeStepId}</span>
      <span data-testid="paused">{journey.isPaused ? "paused" : "running"}</span>
      <button onClick={() => void journey.goToStepByIndex(1)}>by-index</button>
      <button
        onClick={() =>
          void journey.goToStepByIndex(99).then((result) => {
            if (!result.ok) document.title = `idx:${result.reason}`;
          })
        }
      >
        bad-index
      </button>
      <button onClick={() => void journey.goToLastVisitedStep()}>tip</button>
      <button onClick={() => void journey.goToPreviousStep()}>back</button>
      <button onClick={() => journey.controls.pause()}>pause</button>
    </div>
  );
};

describe("<LinearJourney.Step> children form", () => {
  it("declares config without touching the wrapped markup and runs its hooks", async () => {
    const onEnter = vi.fn();
    render(
      <LinearJourney footer={<IndexNav />}>
        <LinearJourney.Step id="intro" meta="Intro meta">
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
  it("navigates by index, reports invalid indexes, walks the timeline tip, and pauses", async () => {
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

    fireEvent.click(screen.getByText("bad-index"));
    await flush();
    expect(document.title).toBe("idx:invalid-target");

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

  it("reports an unknown startStepId through onError with the start phase", async () => {
    const onError = vi.fn();
    render(
      <LinearJourney startStepId="ghost" onError={onError}>
        <StepA id="a" />
      </LinearJourney>
    );
    await flush();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), { phase: "start" });
    expect(screen.getByTestId("step-a")).toBeTruthy();
  });

  it("reports a start-position onLeave effect without undoing navigation", async () => {
    const boom = new Error("initial step refused to leave");
    const onError = vi.fn();
    render(
      <LinearJourney startStepId="b" onError={onError}>
        <LinearJourney.Step
          id="a"
          onLeave={() => {
            throw boom;
          }}
        >
          <StepA />
        </LinearJourney.Step>
        <StepB id="b" />
      </LinearJourney>
    );
    await flush();

    expect(onError).toHaveBeenCalledWith(boom, { phase: "navigate" });
    expect(screen.getByTestId("step-b")).toBeTruthy();
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
});

describe("createLinearJourney extras", () => {
  it("threads startStepId, persist, and plugins through the typed component's props", async () => {
    const storage = memoryStorage();
    const journey = createLinearJourney<{ n: number }>()(["one", "two"]);

    const Forward = () => {
      const state = journey.useLinearJourney();
      return <button onClick={() => void state.goToPreviousStep()}>rewind</button>;
    };

    render(
      <journey.LinearJourney
        context={{ n: 0 }}
        startStepId="two"
        persist={{ key: "bundle", storage }}
        plugins={[]}
        footer={<Forward />}
      >
        <StepA id="one" />
        <StepB id="two" />
      </journey.LinearJourney>
    );
    await flush();
    expect(screen.getByTestId("step-b")).toBeTruthy();
    expect(storage.dump().has("bundle")).toBe(true);

    fireEvent.click(screen.getByText("rewind"));
    await flush();
    expect(screen.getByTestId("step-a")).toBeTruthy();
  });

  it("registers no-op handlers without breaking forward navigation", async () => {
    const Passive = () => {
      useLinearJourneyStep(); // no handler
      return <span data-testid="passive">passive</span>;
    };
    const Forward = () => {
      const journey = useLinearJourney();
      return <button onClick={() => void journey.goToNextStep()}>go</button>;
    };
    render(
      <LinearJourney footer={<Forward />}>
        <Passive id="p" />
        <StepB id="b" />
      </LinearJourney>
    );
    await flush();
    fireEvent.click(screen.getByText("go"));
    await flush();
    expect(screen.getByTestId("step-b")).toBeTruthy();
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
  it("exposes a step onEnter error through useLinearJourney().error", async () => {
    const Failing = () => <span data-testid="failing">failing</span>;
    const Report = () => {
      const journey = useLinearJourney();
      return (
        <div>
          <span data-testid="machine-error">{String(journey.error ?? "none")}</span>
          <button onClick={() => void journey.goToNextStep()}>advance</button>
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
      const state = journey.useLinearJourney();
      return <span data-testid="ctx">{state.context.n}</span>;
    };
    const Forward = () => {
      const state = journey.useLinearJourney();
      return <button onClick={() => void state.goToNextStep()}>onward</button>;
    };

    render(
      <journey.LinearJourney context={{ n: 42 }} footer={<Forward />}>
        <HookedStep id="hooked" />
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
