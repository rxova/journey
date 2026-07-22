import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createLinearJourney } from "@rxova/journey-react";
import { linearToGraphDefinition } from "@rxova/journey-core/convert";
import { flush, makeStep, memoryStorage } from "@rxova/journey-react/testing";

const StepA = makeStep("a");
const StepB = makeStep("b");
const StepC = makeStep("c");

const makeAbc = () => createLinearJourney({ context: { n: 0 }, steps: ["a", "b", "c"] });
const abcViews = { a: <StepA />, b: <StepB />, c: <StepC /> };

describe("linear bundle rendering and navigation", () => {
  it("renders the initial view and navigates through the bundle's verbatim navigate", async () => {
    const journey = makeAbc();
    const Nav = () => {
      const step = journey.useStep();
      const totalSteps = journey.useSnapshot().steps.totalSteps;
      return (
        <div>
          <span data-testid="position">
            {step?.id}:{(step?.index ?? -1) + 1}/{totalSteps}
          </span>
          <span data-testid="flags">
            {step?.isFirstStep ? "first" : ""}
            {step?.isLastStep ? "last" : ""}
            {step?.isFirstTimeVisit ? " fresh" : " revisit"}
          </span>
          <button onClick={() => void journey.navigate.goToNextStep()}>next</button>
          <button onClick={() => void journey.navigate.goToPreviousStep()}>back</button>
          <button onClick={() => void journey.navigate.goToStepById("c")}>jump</button>
        </div>
      );
    };

    render(
      <journey.Provider views={abcViews}>
        <journey.StepRenderer />
        <Nav />
      </journey.Provider>
    );
    await flush();

    expect(screen.getByTestId("step-a")).toBeTruthy();
    expect(screen.getByTestId("position").textContent).toBe("a:1/3");
    expect(screen.getByTestId("flags").textContent).toContain("first");

    fireEvent.click(screen.getByText("next"));
    await flush();
    expect(screen.getByTestId("step-b")).toBeTruthy();
    expect(screen.getByTestId("position").textContent).toBe("b:2/3");
    expect(screen.getByTestId("flags").textContent).toContain("fresh");

    fireEvent.click(screen.getByText("back"));
    await flush();
    expect(screen.getByTestId("position").textContent).toBe("a:1/3");
    expect(screen.getByTestId("flags").textContent).toContain("revisit");

    fireEvent.click(screen.getByText("jump"));
    await flush();
    expect(screen.getByTestId("step-c")).toBeTruthy();
    expect(screen.getByTestId("flags").textContent).toContain("last");
  });

  it("re-renders the active view with its latest props and renders null views as nothing", async () => {
    const journey = createLinearJourney({ context: {}, steps: ["only"] });
    const Probe = ({ flavor }: { flavor: string }) => <span data-testid="probe">{flavor}</span>;
    const view = render(
      <journey.Provider views={{ only: <Probe flavor="salt" /> }}>
        <journey.StepRenderer />
      </journey.Provider>
    );
    await flush();
    expect(screen.getByTestId("probe").textContent).toBe("salt");

    view.rerender(
      <journey.Provider views={{ only: <Probe flavor="pepper" /> }}>
        <journey.StepRenderer />
      </journey.Provider>
    );
    await flush();
    expect(screen.getByTestId("probe").textContent).toBe("pepper");

    const silent = createLinearJourney({ context: {}, steps: ["quiet"] });
    render(
      <silent.Provider views={{ quiet: null }}>
        <silent.StepRenderer fallback={<span data-testid="fb">fb</span>} />
      </silent.Provider>
    );
    await flush();
    // A declared null view renders nothing — the fallback is only for ids
    // missing from the record (plain-JS callers).
    expect(screen.queryByTestId("fb")).toBeNull();
    expect(silent.machine.getSnapshot().currentStep?.id).toBe("quiet");
  });

  it("falls back when a plain-JS views record misses the active id", async () => {
    const journey = createLinearJourney({ context: {}, steps: ["intro", "details"] });
    render(
      <journey.Provider views={{ intro: <StepA /> } as never}>
        <journey.StepRenderer fallback={<span data-testid="missing">missing view</span>} />
      </journey.Provider>
    );
    await flush();
    expect(screen.getByTestId("step-a")).toBeTruthy();

    await act(async () => {
      await journey.navigate.goToNextStep();
    });
    expect(screen.getByTestId("missing")).toBeTruthy();
  });

  it("works fully outside the Provider: the machine is standalone", async () => {
    const journey = makeAbc();

    expect(journey.machine.getSnapshot().currentStep?.id).toBe("a");
    journey.updateContext((context) => ({ n: context.n + 1 }));

    const Lost = () => {
      const context = journey.useContext();
      const controls = journey.useControls();
      return (
        <button data-testid="ctx" onClick={() => controls.complete()}>
          {context.n}
        </button>
      );
    };
    render(<Lost />);
    await flush();
    expect(screen.getByTestId("ctx").textContent).toBe("1");

    fireEvent.click(screen.getByTestId("ctx"));
    await flush();
    expect(journey.machine.getSnapshot().status).toBe("completed");
    expect(journey.useMachine()).toBe(journey.machine);
  });

  it("shares the one machine across Providers; state survives remounts; restart resets", async () => {
    const journey = makeAbc();
    const wizard = (
      <journey.Provider views={abcViews}>
        <journey.StepRenderer />
      </journey.Provider>
    );
    const first = render(wizard);
    await flush();
    await act(async () => {
      await journey.navigate.goToNextStep();
    });
    first.unmount();

    render(wizard);
    await flush();
    expect(screen.getByTestId("step-b")).toBeTruthy(); // not reset by React

    // restart() applies from a terminal status only — terminate first.
    await act(async () => {
      journey.machine.controls.terminate();
      journey.machine.controls.restart();
    });
    await flush();
    expect(screen.getByTestId("step-a")).toBeTruthy();
  });
});

describe("definition step config and start position", () => {
  it("exposes definition metadata through the snapshot", async () => {
    const journey = createLinearJourney({
      context: {},
      steps: [
        { id: "a", metadata: "Alpha" },
        { id: "b", metadata: "Beta" }
      ]
    });
    const Meta = () => {
      const step = journey.useStep();
      return <span data-testid="metadata">{String(step?.metadata)}</span>;
    };
    render(<Meta />);
    await flush();
    expect(screen.getByTestId("metadata").textContent).toBe("Alpha");
  });

  it("starts at options.startAt: earlier steps never enter or leave", async () => {
    const onLeaveA = vi.fn();
    const journey = createLinearJourney(
      { context: {}, steps: [{ id: "a", onLeave: onLeaveA }, "b"] },
      { startAt: "b" }
    );
    render(
      <journey.Provider views={{ a: <StepA />, b: <StepB /> }}>
        <journey.StepRenderer />
      </journey.Provider>
    );
    await flush();

    expect(screen.getByTestId("step-b")).toBeTruthy();
    expect(onLeaveA).not.toHaveBeenCalled();
  });
});

describe("useStepHandler", () => {
  it("blocks forward navigation on a rejected handler and surfaces the error", async () => {
    const journey = createLinearJourney({ context: { n: 0 }, steps: ["guarded", "b"] });
    const Guarded = () => {
      journey.useStepHandler<number>("guarded", {
        run: async ({ snapshot }) => {
          if (snapshot.context.n < 1) {
            throw new Error("n too small");
          }
          return 10;
        },
        commit: ({ result, updateContext }) => {
          updateContext((context) => ({ ...context, n: context.n + result }));
        }
      });
      return <span data-testid="guarded">guarded</span>;
    };
    const Chrome = () => {
      const step = journey.useStep();
      return (
        <div>
          <span data-testid="error">
            {step?.async.error == null ? "none" : String(step.async.error)}
          </span>
          <button onClick={() => journey.updateContext((c) => ({ ...c, n: c.n + 1 }))}>bump</button>
          <button onClick={() => void journey.navigate.goToNextStep()}>next</button>
          <button onClick={() => journey.machine.async.clearError()}>clear</button>
        </div>
      );
    };

    render(
      <journey.Provider views={{ guarded: <Guarded />, b: <StepB /> }}>
        <journey.StepRenderer />
        <Chrome />
      </journey.Provider>
    );
    await flush();

    fireEvent.click(screen.getByText("next"));
    await flush();
    expect(screen.getByTestId("guarded")).toBeTruthy(); // still here
    expect(screen.getByTestId("error").textContent).toContain("n too small");

    fireEvent.click(screen.getByText("clear"));
    await flush();
    expect(screen.getByTestId("error").textContent).toBe("none");

    fireEvent.click(screen.getByText("bump"));
    fireEvent.click(screen.getByText("next"));
    await flush();
    expect(screen.getByTestId("step-b")).toBeTruthy();
  });

  it("unregisters with its component: navigation is ungated after unmount", async () => {
    const journey = createLinearJourney({ context: {}, steps: ["gated", "open"] });
    const run = vi.fn(() => {
      throw new Error("blocked");
    });
    const Gate = () => {
      journey.useStepHandler("gated", { run });
      return <span data-testid="gate">gate</span>;
    };
    const view = render(<Gate />);
    await flush();

    expect((await journey.navigate.goToNextStep()).ok).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
    await act(async () => {
      journey.machine.async.clearError();
    });

    view.unmount();
    await flush();
    expect((await journey.navigate.goToNextStep()).ok).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe("events, persistence, and factory validation", () => {
  it("delivers machine events to useSubscribeEvent listeners", async () => {
    const journey = createLinearJourney({ context: {}, steps: ["a", "b"] });
    const entered: (string | null)[] = [];
    const Listen = () => {
      journey.useSubscribeEvent("stepEnter", ({ to }) => entered.push(to));
      return null;
    };
    render(<Listen />);
    await flush();

    await act(async () => {
      await journey.navigate.goToNextStep();
    });
    // The initial "a" entry happened at factory creation, before any mount.
    expect(entered).toEqual(["b"]);
  });

  it("threads the persist option through to core and restores across bundles", async () => {
    const storage = memoryStorage();
    const first = createLinearJourney(
      { context: { n: 0 }, steps: ["a", "b"] },
      { persist: { key: "wiz", storage } }
    );
    // The factory's initial entry is still settling right after creation; let
    // it commit before navigating.
    await flush();
    await act(async () => {
      await first.navigate.goToNextStep();
      first.updateContext(() => ({ n: 7 }));
    });
    await flush();

    const persisted = JSON.parse(storage.dump().get("wiz") ?? "null");
    expect(persisted).toMatchObject({ timeline: ["a", "b"], currentIndex: 1 });

    // A new bundle over the same key restores the persisted position/context.
    const second = createLinearJourney(
      { context: { n: 0 }, steps: ["a", "b"] },
      { persist: { key: "wiz", storage } }
    );
    const snapshot = second.machine.getSnapshot();
    expect(snapshot.currentStep?.id).toBe("b");
    expect(snapshot.context).toEqual({ n: 7 });
  });

  it("honours autoStart: false — fallback until started explicitly", async () => {
    const journey = createLinearJourney({ context: {}, steps: ["a"] }, { autoStart: false });
    render(
      <journey.Provider views={{ a: <StepA /> }}>
        <journey.StepRenderer fallback={<span data-testid="idle">idle</span>} />
      </journey.Provider>
    );
    await flush();
    expect(screen.getByTestId("idle")).toBeTruthy();

    await act(async () => {
      journey.machine.controls.start();
    });
    await flush();
    expect(screen.getByTestId("step-a")).toBeTruthy();
  });

  it("rejects duplicate and empty step declarations, names the Provider, converts to graph", () => {
    expect(() => createLinearJourney({ context: {}, steps: ["dup", "dup"] })).toThrow(
      /must be unique/
    );
    expect(() => createLinearJourney({ context: {}, steps: [] as never })).toThrow(
      /at least one step/
    );

    const anonymous = createLinearJourney({ context: {}, steps: ["a"] });
    expect((anonymous.Provider as { displayName?: string }).displayName).toBe(
      "LinearJourney.Provider"
    );
    const named = createLinearJourney({ name: "signup", context: {}, steps: ["a"] });
    expect((named.Provider as { displayName?: string }).displayName).toBe("signup.Provider");

    const definition = { context: { n: 1 }, steps: ["intro", "details"] } as const;
    void createLinearJourney(definition);
    const graphDefinition = linearToGraphDefinition(definition);
    expect(graphDefinition.initial).toBe("intro");
    expect(graphDefinition.transitions.NEXT).toMatchObject([{ from: "intro", to: "details" }]);
  });

  it("guards only StepRenderer against missing views", () => {
    const journey = createLinearJourney({ context: {}, steps: ["a"] });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<journey.StepRenderer />)).toThrow(/inside this bundle's <Provider>/);
    consoleError.mockRestore();
  });
});
