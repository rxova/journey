import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createGraphJourney } from "@rxova/journey-react/graph";
import { flush, makeStep } from "@rxova/journey-react/testing";

type Ctx = { attempts: number };

const makeBundle = () =>
  createGraphJourney({
    steps: { form: {}, review: {}, done: {} },
    transitions: {
      SUBMIT: { from: "form", to: "review" },
      EDIT: { from: "review", to: "form" },
      CONFIRM: { from: "review", to: "done" }
    },
    initial: "form",
    context: { attempts: 0 } as Ctx
  });

const Form = makeStep("form");
const Review = makeStep("review");
const Done = makeStep("done");
const views = { form: <Form />, review: <Review />, done: <Done /> };

describe("graph bundle", () => {
  it("renders the initial view and moves via the bundle's verbatim send", async () => {
    const bundle = makeBundle();
    const Controls = () => {
      const navigate = bundle.useNavigation();
      const available = bundle.useSelector((snapshot) => snapshot.availableEvents.join(","));
      return (
        <div>
          <span data-testid="events">{available}</span>
          <button onClick={() => void bundle.send("SUBMIT")}>submit</button>
          <button onClick={() => void navigate.goToPreviousStep()}>back</button>
        </div>
      );
    };

    render(
      <bundle.Provider views={views}>
        <Controls />
        <bundle.StepRenderer fallback={<span data-testid="fallback">…</span>} />
      </bundle.Provider>
    );
    await flush();

    expect(screen.getByTestId("step-form")).toBeTruthy();
    expect(screen.getByTestId("events").textContent).toBe("SUBMIT");

    fireEvent.click(screen.getByText("submit"));
    await flush();
    expect(screen.getByTestId("step-review")).toBeTruthy();
    expect(screen.getByTestId("events").textContent).toBe("EDIT,CONFIRM");

    fireEvent.click(screen.getByText("back")); // timeline move bypasses gating
    await flush();
    expect(screen.getByTestId("step-form")).toBeTruthy();
  });

  it("exposes the snapshot, current step data, and events through bundle hooks", async () => {
    const bundle = makeBundle();
    const entered: string[] = [];
    const Probe = () => {
      const snapshot = bundle.useSnapshot();
      const step = bundle.useStep();
      bundle.useSubscribeEvent("stepEnter", ({ to }) => entered.push(to));
      return (
        <span data-testid="status">
          {snapshot.status}:{step?.id}:{step?.async.isSuccess ? "ok" : "…"}
        </span>
      );
    };
    render(<Probe />);
    await flush();
    expect(screen.getByTestId("status").textContent).toBe("running:form:ok");

    await act(async () => {
      await bundle.send("SUBMIT");
    });
    expect(entered).toEqual(["review"]);
    expect(screen.getByTestId("status").textContent).toBe("running:review:ok");
  });

  it("works fully outside the Provider: the machine is standalone", async () => {
    const bundle = makeBundle();

    // Non-React access before anything renders.
    expect(bundle.machine.getSnapshot().currentStep?.id).toBe("form");
    bundle.updateContext((context) => ({ attempts: context.attempts + 1 }));

    const Lost = () => {
      const context = bundle.useContext();
      const controls = bundle.useControls();
      return (
        <button data-testid="ctx" onClick={() => controls.complete()}>
          {context.attempts}
        </button>
      );
    };
    render(<Lost />);
    await flush();
    expect(screen.getByTestId("ctx").textContent).toBe("1");

    fireEvent.click(screen.getByTestId("ctx"));
    await flush();
    expect(bundle.machine.getSnapshot().status).toBe("completed");
  });

  it("shares the one machine across every Provider and hook", async () => {
    const bundle = makeBundle();
    const Attempts = ({ testId }: { testId: string }) => {
      const attempts = bundle.useSelector((snapshot) => snapshot.context.attempts);
      return <span data-testid={testId}>{attempts}</span>;
    };
    render(
      <>
        <bundle.Provider views={views}>
          <Attempts testId="first" />
        </bundle.Provider>
        <bundle.Provider views={views}>
          <Attempts testId="second" />
        </bundle.Provider>
      </>
    );
    await flush();

    await act(async () => {
      bundle.updateContext((context) => ({ attempts: context.attempts + 7 }));
    });
    expect(screen.getByTestId("first").textContent).toBe("7");
    expect(screen.getByTestId("second").textContent).toBe("7");
    expect(bundle.useMachine()).toBe(bundle.machine);
  });

  it("state survives a remount; restart is the explicit reset", async () => {
    const bundle = makeBundle();
    const journey = (
      <bundle.Provider views={views}>
        <bundle.StepRenderer />
      </bundle.Provider>
    );
    const first = render(journey);
    await flush();
    await act(async () => {
      await bundle.send("SUBMIT");
    });
    first.unmount();

    render(journey);
    await flush();
    expect(screen.getByTestId("step-review")).toBeTruthy(); // not reset by React

    // restart() applies from a terminal status only — terminate first.
    await act(async () => {
      bundle.machine.controls.terminate();
      bundle.machine.controls.restart();
    });
    await flush();
    expect(screen.getByTestId("step-form")).toBeTruthy();
  });

  it("honours autoStart: false — fallback until started explicitly", async () => {
    const bundle = createGraphJourney(
      {
        steps: { form: {}, done: {} },
        transitions: { FINISH: { from: "form", to: "done" } },
        initial: "form",
        context: {}
      },
      { autoStart: false }
    );
    render(
      <bundle.Provider views={{ form: <Form />, done: <Done /> }}>
        <bundle.StepRenderer fallback={<span data-testid="fallback">waiting</span>} />
      </bundle.Provider>
    );
    await flush();
    expect(screen.getByTestId("fallback")).toBeTruthy();

    await act(async () => {
      bundle.machine.controls.start();
    });
    await flush();
    expect(screen.getByTestId("step-form")).toBeTruthy();
  });

  it("guards only StepRenderer against missing views", () => {
    const bundle = makeBundle();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<bundle.StepRenderer />)).toThrow(/inside this bundle's <Provider>/);
    consoleError.mockRestore();
  });
});

describe("graph bundle edges", () => {
  it("updates context through the bundle and honours custom selector equality", async () => {
    const bundle = makeBundle();
    const seen: unknown[] = [];
    const kindSelector = (snapshot: { context: Ctx }) => ({ attempts: snapshot.context.attempts });
    const closeEnough = (a: { attempts: number }, b: { attempts: number }) =>
      Math.abs(a.attempts - b.attempts) < 10;
    const Probe = () => {
      const stable = bundle.useSelector(kindSelector as never, closeEnough as never);
      seen.push(stable);
      return (
        <button onClick={() => bundle.updateContext((c) => ({ attempts: c.attempts + 1 }))}>
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

  it("command groups are stable machine properties across re-renders", async () => {
    const bundle = makeBundle();
    const controlsSeen = new Set<unknown>();
    const navigationSeen = new Set<unknown>();
    const Probe = () => {
      controlsSeen.add(bundle.useControls());
      navigationSeen.add(bundle.useNavigation());
      const n = bundle.useSelector((snapshot) => snapshot.context.attempts);
      return <span data-testid="n">{n}</span>;
    };
    render(<Probe />);
    await flush();
    await act(async () => {
      bundle.updateContext((c) => ({ attempts: c.attempts + 1 }));
    });
    await act(async () => {
      bundle.updateContext((c) => ({ attempts: c.attempts + 1 }));
    });

    expect(screen.getByTestId("n").textContent).toBe("2");
    expect(controlsSeen.size).toBe(1);
    expect(navigationSeen.size).toBe(1);
  });

  it("names the Provider and StepRenderer for DevTools from the definition name", () => {
    const named = createGraphJourney({
      steps: { form: {}, done: {} },
      transitions: { FINISH: { from: "form", to: "done" } },
      initial: "form",
      context: {},
      name: "checkout"
    });
    expect((named.Provider as { displayName?: string }).displayName).toBe("checkout.Provider");
    expect((named.StepRenderer as { displayName?: string }).displayName).toBe(
      "checkout.StepRenderer"
    );

    const anonymous = makeBundle();
    expect((anonymous.Provider as { displayName?: string }).displayName).toBe(
      "GraphJourney.Provider"
    );
  });

  it("renders under StrictMode without duplicating machines or subscriptions", async () => {
    const bundle = makeBundle();
    render(
      <React.StrictMode>
        <bundle.Provider views={views}>
          <bundle.StepRenderer />
        </bundle.Provider>
      </React.StrictMode>
    );
    await flush();
    expect(screen.getByTestId("step-form")).toBeTruthy();

    await act(async () => {
      await bundle.send("SUBMIT");
    });
    expect(screen.getByTestId("step-review")).toBeTruthy();
  });
});
