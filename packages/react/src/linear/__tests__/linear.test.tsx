import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createLinearJourney } from "@rxova/journey-react";
import { linearToGraphDefinition } from "@rxova/journey-core/convert";
import { flush, makeStep, memoryStorage } from "@rxova/journey-react/testing";
import type { LinearJourneyMachine } from "@rxova/journey-react";

const StepA = makeStep("a");
const StepB = makeStep("b");
const StepC = makeStep("c");

const abc = createLinearJourney({ context: { n: 0 }, steps: ["a", "b", "c"] });

const Nav = () => {
  const { machine, snapshot } = abc.useJourney();
  const currentStep = snapshot.currentStep;
  return (
    <div>
      <span data-testid="position">
        {currentStep.id}:{currentStep.index + 1}/{snapshot.steps.totalSteps}
      </span>
      <span data-testid="flags">
        {currentStep.isFirstStep ? "first" : ""}
        {currentStep.isLastStep ? "last" : ""}
        {currentStep.isFirstTimeVisit ? " fresh" : " revisit"}
      </span>
      <span data-testid="context-n">{snapshot.context.n}</span>
      <button onClick={() => void machine.navigate.goToNextStep()}>next</button>
      <button onClick={() => void machine.navigate.goToPreviousStep()}>back</button>
      <button onClick={() => void machine.navigate.goToStepById("c")}>jump</button>
      <button onClick={() => machine.controls.complete()}>finish</button>
    </div>
  );
};

const AbcJourney = (props: Partial<Parameters<typeof abc.Provider>[0]>) => (
  <abc.Provider footer={<Nav />} {...props}>
    <StepA id="a" />
    <StepB id="b" />
    <StepC id="c" />
  </abc.Provider>
);

describe("bundle Provider rendering and navigation", () => {
  it("renders the first step and navigates through the verbatim machine", async () => {
    render(<AbcJourney />);
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

  it("strips the id prop before rendering the step component", async () => {
    const seenProps: unknown[] = [];
    const Probe = (props: Record<string, unknown>) => {
      seenProps.push(props);
      return <span>probe</span>;
    };
    const journey = createLinearJourney({ context: {}, steps: ["only"] });
    render(
      <journey.Provider>
        <Probe id="only" flavor="salt" />
      </journey.Provider>
    );
    await flush();
    expect(seenProps[0]).toEqual({ flavor: "salt" });
  });

  it("enforces unique mandatory ids on the children", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const journey = createLinearJourney({ context: {}, steps: ["dup", "other"] });
    expect(() =>
      render(
        <journey.Provider>
          <StepA id="dup" />
          <StepB id="dup" />
        </journey.Provider>
      )
    ).toThrow(/duplicate id "dup"/);
    expect(() =>
      render(
        <journey.Provider>
          <StepA />
          <StepB id="other" />
        </journey.Provider>
      )
    ).toThrow(/mandatory unique "id"/);
    consoleError.mockRestore();
  });

  it("rejects children whose ids don't cover the definition", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const journey = createLinearJourney({ context: {}, steps: ["intro", "details"] });
    expect(() =>
      render(
        <journey.Provider>
          <StepA id="intro" />
          <StepB id="detials" />
        </journey.Provider>
      )
    ).toThrow(/missing \[details\]; undeclared \[detials\]/);
    expect(() =>
      render(
        <journey.Provider>
          <StepA id="intro" />
        </journey.Provider>
      )
    ).toThrow(/missing \[details\]\./);
    expect(() =>
      render(
        <journey.Provider>
          <StepA id="intro" />
          <StepB id="details" />
          <StepC id={"extra" as never} />
        </journey.Provider>
      )
    ).toThrow(/undeclared \[extra\]\./);
    consoleError.mockRestore();
  });

  it("throws when a rerender stops covering the definition", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const journey = createLinearJourney({ context: {}, steps: ["a", "b"] });
    const Dynamic = ({ narrow }: { narrow: boolean }) => (
      <journey.Provider>
        <StepA id="a" />
        {narrow ? null : <StepB id="b" />}
      </journey.Provider>
    );
    const view = render(<Dynamic narrow={false} />);
    await flush();
    expect(screen.getByTestId("step-a")).toBeTruthy();

    expect(() => view.rerender(<Dynamic narrow={true} />)).toThrow(/missing \[b\]/);
    consoleError.mockRestore();
  });

  it("warns in dev when the children order fights the definition order", async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const journey = createLinearJourney({ context: {}, steps: ["a", "b"] });
    render(
      <journey.Provider>
        <StepB id="b" />
        <StepA id="a" />
      </journey.Provider>
    );
    await flush();
    // The definition wins: the machine still starts at its first step.
    expect(screen.getByTestId("step-a")).toBeTruthy();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("The definition's order drives the machine")
    );
    consoleError.mockRestore();
    delete (globalThis as { __DEV__?: boolean }).__DEV__;
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
      const { snapshot } = journey.useJourney();
      return <span data-testid="metadata">{String(snapshot.currentStep.metadata)}</span>;
    };
    render(
      <journey.Provider footer={<Meta />}>
        <StepA id="a" />
        <StepB id="b" />
      </journey.Provider>
    );
    await flush();
    expect(screen.getByTestId("metadata").textContent).toBe("Alpha");
  });

  it("starts at the startAt prop, which wins over the bundle options' startAt", async () => {
    const journey = createLinearJourney({ context: {}, steps: ["a", "b", "c"] }, { startAt: "b" });
    const journeySteps = (
      <>
        <StepA id="a" />
        <StepB id="b" />
        <StepC id="c" />
      </>
    );
    const optionsOnly = render(<journey.Provider>{journeySteps}</journey.Provider>);
    await flush();
    expect(screen.getByTestId("step-b")).toBeTruthy();
    optionsOnly.unmount();
    await flush();

    render(<journey.Provider startAt="c">{journeySteps}</journey.Provider>);
    await flush();
    expect(screen.getByTestId("step-c")).toBeTruthy();
  });
});

describe("useStep", () => {
  const guarded = createLinearJourney({ context: { n: 0 }, steps: ["guarded", "b"] });
  const Guarded = () => {
    guarded.useStep<number>({
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
  const GuardedChrome = () => {
    const { machine, snapshot } = guarded.useJourney();
    return (
      <div>
        <span data-testid="error">
          {snapshot.currentStep.async.error == null
            ? "none"
            : String(snapshot.currentStep.async.error)}
        </span>
        <button onClick={() => machine.context.update((c) => ({ ...c, n: c.n + 1 }))}>bump</button>
        <button onClick={() => void machine.navigate.goToNextStep()}>next</button>
        <button onClick={() => machine.async.clearError()}>clear</button>
      </div>
    );
  };

  it("blocks forward navigation on a rejected handler and surfaces the error", async () => {
    const onError = vi.fn();
    render(
      <guarded.Provider onError={onError} footer={<GuardedChrome />}>
        <guarded.Step id="guarded">
          <Guarded />
        </guarded.Step>
        <StepB id="b" />
      </guarded.Provider>
    );
    await flush();

    fireEvent.click(screen.getByText("next"));
    await flush();
    expect(screen.getByTestId("guarded")).toBeTruthy(); // still here
    expect(screen.getByTestId("error").textContent).toContain("n too small");
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error), phase: "work", stepId: "guarded" })
    );

    fireEvent.click(screen.getByText("clear"));
    await flush();
    expect(screen.getByTestId("error").textContent).toBe("none");

    fireEvent.click(screen.getByText("bump"));
    fireEvent.click(screen.getByText("next"));
    await flush();
    expect(screen.getByTestId("step-b")).toBeTruthy();
  });
});

describe("journey callbacks and machine escape hatches", () => {
  it("forwards core events to the callback props verbatim", async () => {
    const onStart = vi.fn();
    const onStepEnter = vi.fn();
    const onStepLeave = vi.fn();
    const onComplete = vi.fn();
    const machineRef = React.createRef<LinearJourneyMachine<{ n: number }, "a" | "b" | "c">>();

    render(
      <AbcJourney
        onStart={onStart}
        onStepEnter={onStepEnter}
        onStepLeave={onStepLeave}
        onComplete={onComplete}
        machineRef={machineRef}
      />
    );
    await flush();
    expect(machineRef.current?.getSnapshot().currentStep?.id).toBe("a");
    expect(onStart).toHaveBeenCalledTimes(1);
    // The layout-effect start attaches subscribers first, so the initial
    // entry itself is forwarded verbatim.
    expect(onStepEnter).toHaveBeenCalledWith(
      expect.objectContaining({ from: null, to: "a", direction: "jump" })
    );
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({ currentStep: expect.objectContaining({ id: "a" }) })
    );

    fireEvent.click(screen.getByText("next"));
    await flush();
    expect(onStepEnter).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: "a", to: "b", direction: "forward" })
    );
    expect(onStepLeave).toHaveBeenLastCalledWith(expect.objectContaining({ from: "a", to: "b" }));

    fireEvent.click(screen.getByText("back"));
    await flush();
    expect(onStepEnter).toHaveBeenLastCalledWith(
      expect.objectContaining({ direction: "backward" })
    );

    fireEvent.click(screen.getByText("jump")); // a → c skips b
    await flush();
    expect(onStepEnter).toHaveBeenLastCalledWith(
      expect.objectContaining({ to: "c", direction: "jump" })
    );

    fireEvent.click(screen.getByText("finish"));
    await flush();
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ current: "completed" }));
  });

  it("threads the persist option through to core", async () => {
    const storage = memoryStorage();
    const journey = createLinearJourney(
      { context: {}, steps: ["a", "b"] },
      { persist: { key: "wiz", storage } }
    );
    const Forward = () => {
      const { machine } = journey.useJourney();
      return <button onClick={() => void machine.navigate.goToNextStep()}>next</button>;
    };
    render(
      <journey.Provider footer={<Forward />}>
        <StepA id="a" />
        <StepB id="b" />
      </journey.Provider>
    );
    await flush();
    fireEvent.click(screen.getByText("next"));
    await flush();

    const persisted = JSON.parse(storage.dump().get("wiz") ?? "null");
    expect(persisted).toMatchObject({ timeline: ["a", "b"], currentIndex: 1 });
  });

  it("disposes the machine on unmount", async () => {
    const machineRef = React.createRef<LinearJourneyMachine<{ n: number }, "a" | "b" | "c">>();
    const view = render(<AbcJourney machineRef={machineRef} />);
    await flush();
    const machine = machineRef.current!;
    view.unmount();
    await flush();
    expect(await machine.navigate.goToNextStep()).toEqual({ ok: false, reason: "disposed" });
  });
});

describe("initialContext override", () => {
  it("defaults to the definition context and lets the Provider override it at mount", async () => {
    const journey = createLinearJourney({ context: { n: 5 }, steps: ["a"] });
    const ShowN = () => {
      const n = journey.useSelector((snapshot) => snapshot.context.n);
      return <span data-testid="n">{n}</span>;
    };
    const fromDefinition = render(
      <journey.Provider footer={<ShowN />}>
        <StepA id="a" />
      </journey.Provider>
    );
    await flush();
    expect(screen.getByTestId("n").textContent).toBe("5");
    fromDefinition.unmount();
    await flush();

    render(
      <journey.Provider initialContext={{ n: 42 }} footer={<ShowN />}>
        <StepA id="a" />
      </journey.Provider>
    );
    await flush();
    expect(screen.getByTestId("n").textContent).toBe("42");
  });
});

describe("options.autoStart", () => {
  it("false renders the fallback until the machine is started manually", async () => {
    const onStart = vi.fn();
    const journey = createLinearJourney({ context: {}, steps: ["a"] }, { autoStart: false });
    const machineRef = React.createRef<LinearJourneyMachine<Record<string, never>, "a">>();
    render(
      <journey.Provider
        fallback={<span data-testid="idle">idle</span>}
        onStart={onStart}
        machineRef={machineRef}
      >
        <StepA id="a" />
      </journey.Provider>
    );
    await flush();
    expect(screen.getByTestId("idle")).toBeTruthy();
    expect(onStart).not.toHaveBeenCalled();

    await act(async () => {
      machineRef.current?.controls.start();
    });
    await flush();
    expect(screen.getByTestId("step-a")).toBeTruthy();
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});

describe("factory validation and graph migration", () => {
  it("rejects duplicate and empty step declarations", () => {
    expect(() => createLinearJourney({ context: {}, steps: ["dup", "dup"] })).toThrow(
      /must be unique/
    );
    expect(() => createLinearJourney({ context: {}, steps: [] as never })).toThrow(
      /at least one step/
    );
  });

  it("converts the captured definition with core's external helper", () => {
    const definition = { context: { n: 1 }, steps: ["intro", "details"] } as const;
    const journey = createLinearJourney(definition);
    void journey;

    const graphDefinition = linearToGraphDefinition(definition);
    expect(graphDefinition.initial).toBe("intro");
    expect(graphDefinition.transitions.NEXT).toMatchObject([{ from: "intro", to: "details" }]);
  });
});

describe("hook guards", () => {
  it("bundle hooks throw outside their own Provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const Lost = () => {
      abc.useJourney();
      return null;
    };
    expect(() => render(<Lost />)).toThrow(/inside this journey's <Provider>/);

    const LostSelector = () => {
      abc.useSelector((snapshot) => snapshot.status);
      return null;
    };
    expect(() => render(<LostSelector />)).toThrow(/inside this journey's <Provider>/);

    // Bundles are isolated: another journey's Provider does not satisfy abc's hooks.
    const other = createLinearJourney({ context: {}, steps: ["solo"] });
    const Crossed = () => {
      abc.useJourney();
      return null;
    };
    expect(() =>
      render(
        <other.Provider header={<Crossed />}>
          <StepA id="solo" />
        </other.Provider>
      )
    ).toThrow(/inside this journey's <Provider>/);
    consoleError.mockRestore();
  });
});
