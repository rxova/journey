import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  createLinearJourney,
  useLinearJourney,
  useLinearJourneySelector,
  useLinearJourneyStep,
  LinearJourney
} from "@rxova/journey-react";
import { flush, makeStep, memoryStorage } from "@rxova/journey-react/testing";
import type { LinearJourneyMachine } from "@rxova/journey-react";

const StepA = makeStep("a");
const StepB = makeStep("b");
const StepC = makeStep("c");

const Nav = () => {
  const journey = useLinearJourney<{ n: number }>();
  return (
    <div>
      <span data-testid="position">
        {journey.activeStepId}:{journey.activeStepIndex + 1}/{journey.stepCount}
      </span>
      <span data-testid="flags">
        {journey.isFirstStep ? "first" : ""}
        {journey.isLastStep ? "last" : ""}
        {journey.isStepFirstTimeVisit ? " fresh" : " revisit"}
      </span>
      <span data-testid="error">{journey.error === null ? "none" : String(journey.error)}</span>
      <button onClick={() => void journey.goToNextStep()}>next</button>
      <button onClick={() => void journey.goToPreviousStep()}>back</button>
      <button onClick={() => void journey.goToStepById("c" as never)}>jump</button>
      <button onClick={() => journey.controls.complete()}>finish</button>
      <button onClick={() => journey.clearError()}>clear</button>
    </div>
  );
};

describe("<LinearJourney> children form", () => {
  it("renders the first step and navigates through useLinearJourney", async () => {
    render(
      <LinearJourney footer={<Nav />}>
        <StepA id="a" />
        <StepB id="b" />
        <StepC id="c" />
      </LinearJourney>
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

  it("strips the id prop before rendering the step component", async () => {
    const seenProps: unknown[] = [];
    const Probe = (props: Record<string, unknown>) => {
      seenProps.push(props);
      return <span>probe</span>;
    };
    render(
      <LinearJourney>
        <Probe id="only" flavor="salt" />
      </LinearJourney>
    );
    await flush();
    expect(seenProps[0]).toEqual({ flavor: "salt" });
  });

  it("enforces unique mandatory ids and exclusive step sources", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() =>
      render(
        <LinearJourney>
          <StepA id="dup" />
          <StepB id="dup" />
        </LinearJourney>
      )
    ).toThrow(/duplicate id "dup"/);
    expect(() =>
      render(
        <LinearJourney steps={{ a: StepA }}>
          <StepB id="b" />
        </LinearJourney>
      )
    ).toThrow(/not both/);
    expect(() =>
      render(
        <LinearJourney>
          <StepA />
        </LinearJourney>
      )
    ).toThrow(/mandatory unique "id"/);
    consoleError.mockRestore();
  });
});

describe("<LinearJourney> steps object form", () => {
  it("uses key order, exposes meta, and supports LinearJourney.Step config", async () => {
    const Meta = () => {
      const journey = useLinearJourney();
      return (
        <span data-testid="meta">
          {String(journey.activeStepMeta)}|{String(journey.getStepMeta("b" as never))}
        </span>
      );
    };
    render(
      <LinearJourney
        steps={{
          a: { component: StepA, meta: "Alpha" },
          b: { component: StepB, meta: "Beta" }
        }}
        footer={<Meta />}
      />
    );
    await flush();
    expect(screen.getByTestId("meta").textContent).toBe("Alpha|Beta");
  });

  it("starts at startStepId, which wins over startIndex", async () => {
    render(
      <LinearJourney steps={{ a: StepA, b: StepB, c: StepC }} startStepId="b" startIndex={2} />
    );
    await flush();
    expect(screen.getByTestId("step-b")).toBeTruthy();
  });

  it("starts at startIndex when no startStepId is given", async () => {
    render(<LinearJourney steps={{ a: StepA, b: StepB, c: StepC }} startIndex={2} />);
    await flush();
    expect(screen.getByTestId("step-c")).toBeTruthy();
  });
});

describe("useLinearJourneyStep", () => {
  const Guarded = () => {
    useLinearJourneyStep<{ n: number }>(async ({ context, updateContext }) => {
      if (context.n < 1) {
        throw new Error("n too small");
      }
      updateContext((c) => ({ ...c, n: c.n + 10 }));
    });
    return <span data-testid="guarded">guarded</span>;
  };
  const Bump = () => {
    const journey = useLinearJourney<{ n: number }>();
    return (
      <button onClick={() => journey.updateContext((c) => ({ ...c, n: c.n + 1 }))}>bump</button>
    );
  };

  it("blocks forward navigation on a rejected handler and surfaces the error", async () => {
    const onError = vi.fn();
    render(
      <LinearJourney context={{ n: 0 }} onError={onError} footer={<Nav />} header={<Bump />}>
        <Guarded id="guarded" />
        <StepB id="b" />
      </LinearJourney>
    );
    await flush();

    fireEvent.click(screen.getByText("next"));
    await flush();
    expect(screen.getByTestId("guarded")).toBeTruthy(); // still here
    expect(screen.getByTestId("error").textContent).toContain("n too small");
    expect(onError).toHaveBeenCalledWith(expect.any(Error), { phase: "step-handler" });

    fireEvent.click(screen.getByText("clear"));
    await flush();
    expect(screen.getByTestId("error").textContent).toBe("none");
    fireEvent.click(screen.getByText("clear")); // nothing left to clear: no-op
    await flush();

    fireEvent.click(screen.getByText("bump"));
    fireEvent.click(screen.getByText("next"));
    await flush();
    expect(screen.getByTestId("step-b")).toBeTruthy();
  });
});

describe("linear journey callbacks and machine escape hatches", () => {
  it("fires step callbacks with directions and completion", async () => {
    const onStepChange = vi.fn();
    const onStepEnter = vi.fn();
    const onStepLeave = vi.fn();
    const onComplete = vi.fn();
    const machineRef = React.createRef<LinearJourneyMachine<{ n: number }>>();

    render(
      <LinearJourney
        context={{ n: 0 }}
        onStepChange={onStepChange}
        onStepEnter={onStepEnter}
        onStepLeave={onStepLeave}
        onComplete={onComplete}
        machineRef={machineRef}
        footer={<Nav />}
      >
        <StepA id="a" />
        <StepB id="b" />
        <StepC id="c" />
      </LinearJourney>
    );
    await flush();
    expect(machineRef.current?.getSnapshot().currentStep?.id).toBe("a");

    fireEvent.click(screen.getByText("next"));
    await flush();
    expect(onStepEnter).toHaveBeenLastCalledWith({ stepId: "b", context: { n: 0 } });
    expect(onStepLeave).toHaveBeenLastCalledWith({ stepId: "a", context: { n: 0 } });
    expect(onStepChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ fromStepId: "a", toStepId: "b", direction: "forward" })
    );

    fireEvent.click(screen.getByText("back"));
    await flush();
    expect(onStepChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ direction: "backward" })
    );

    fireEvent.click(screen.getByText("jump")); // a → c skips b
    await flush();
    expect(onStepChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ toStepId: "c", direction: "jump" })
    );

    fireEvent.click(screen.getByText("finish"));
    await flush();
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ context: { n: 0 } }));
  });

  it("defaults the persist storage to localStorage", async () => {
    localStorage.removeItem("wiz-default");
    render(
      <LinearJourney persist={{ key: "wiz-default" }}>
        <StepA id="a" />
      </LinearJourney>
    );
    await flush();
    expect(localStorage.getItem("wiz-default")).toContain('"timeline":["a"]');
  });

  it("persists navigation through the persist sugar", async () => {
    const storage = memoryStorage();
    render(
      <LinearJourney persist={{ key: "wiz", storage }} footer={<Nav />}>
        <StepA id="a" />
        <StepB id="b" />
      </LinearJourney>
    );
    await flush();
    fireEvent.click(screen.getByText("next"));
    await flush();

    const persisted = JSON.parse(storage.dump().get("wiz") ?? "null");
    expect(persisted).toMatchObject({ timeline: ["a", "b"], currentIndex: 1 });
  });

  it("disposes the machine on unmount", async () => {
    const machineRef = React.createRef<LinearJourneyMachine>();
    const view = render(
      <LinearJourney machineRef={machineRef}>
        <StepA id="a" />
      </LinearJourney>
    );
    await flush();
    const machine = machineRef.current!;
    view.unmount();
    await flush();
    expect(await machine.navigate.goToNextStep()).toEqual({ ok: false, reason: "disposed" });
  });

  it("swaps machines when the derived step list changes, keeping position and context", async () => {
    const Dynamic = ({ extended }: { extended: boolean }) => (
      <LinearJourney context={{ n: 5 }} footer={<Nav />}>
        <StepA id="a" />
        <StepB id="b" />
        {extended ? <StepC id="c" /> : null}
      </LinearJourney>
    );
    const view = render(<Dynamic extended={false} />);
    await flush();
    fireEvent.click(screen.getByText("next"));
    await flush();
    expect(screen.getByTestId("position").textContent).toBe("b:2/2");

    view.rerender(<Dynamic extended={true} />);
    await flush();
    expect(screen.getByTestId("position").textContent).toBe("b:2/3");
  });
});

describe("createLinearJourney bundle", () => {
  it("returns a pre-bound LinearJourney with typed hooks and a graph converter", async () => {
    const bundle = createLinearJourney({
      context: { n: 1 },
      steps: { intro: StepA, details: StepB }
    });

    const BundleFooter = () => {
      const journey = bundle.useLinearJourney();
      const stepCount = bundle.useLinearJourneySelector((snapshot) => snapshot.steps.totalSteps);
      return (
        <span data-testid="bundle">
          {journey.activeStepId}/{stepCount}
        </span>
      );
    };
    render(<bundle.LinearJourney footer={<BundleFooter />} />);
    await flush();
    expect(screen.getByTestId("bundle").textContent).toBe("intro/2");

    const definition = bundle.toGraphDefinition();
    expect(definition.initial).toBe("intro");
    expect(definition.transitions.NEXT).toMatchObject([{ from: "intro", to: "details" }]);
  });
});

describe("hook guards", () => {
  it("useLinearJourney and useLinearJourneySelector throw outside a <LinearJourney>", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const Lost = () => {
      useLinearJourney();
      return null;
    };
    expect(() => render(<Lost />)).toThrow(/inside a <LinearJourney>/);
    const LostSelector = () => {
      useLinearJourneySelector((snapshot) => snapshot.status);
      return null;
    };
    expect(() => render(<LostSelector />)).toThrow(/inside a <LinearJourney>/);
    consoleError.mockRestore();
  });
});
