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

const views = {
  form: makeStep("form"),
  review: makeStep("review"),
  done: makeStep("done")
};

describe("graph bundle", () => {
  it("renders the initial view and moves via useApi().send", async () => {
    const bundle = makeBundle();
    const Controls = () => {
      const api = bundle.useApi();
      const available = bundle.useSelector((snapshot) => snapshot.availableEvents.join(","));
      return (
        <div>
          <span data-testid="events">{available}</span>
          <button onClick={() => void api.send("SUBMIT")}>submit</button>
          <button onClick={() => void api.navigate.goToPreviousStep()}>back</button>
          <button onClick={() => api.controls.complete()}>complete</button>
          <button onClick={() => api.updateContext((c) => ({ attempts: c.attempts + 1 }))}>
            bump
          </button>
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

  it("exposes snapshot, step async state, lifecycle, and events through bundle hooks", async () => {
    const bundle = makeBundle();
    const entered: string[] = [];
    const lifecycle = vi.fn();
    const Probe = () => {
      const snapshot = bundle.useSnapshot();
      const asyncState = bundle.useStepAsyncState("form");
      bundle.useEvent("stepEnter", ({ to }) => entered.push(to));
      bundle.useStepLifecycle("review", { onEnter: lifecycle });
      const api = bundle.useApi();
      return (
        <div>
          <span data-testid="status">
            {snapshot.status}:{snapshot.currentStep?.id}:{asyncState.isSuccess ? "ok" : "…"}
          </span>
          <button onClick={() => void api.send("SUBMIT")}>go</button>
        </div>
      );
    };
    render(
      <bundle.Provider views={views}>
        <Probe />
      </bundle.Provider>
    );
    await flush();
    expect(screen.getByTestId("status").textContent).toBe("running:form:ok");

    fireEvent.click(screen.getByText("go"));
    await flush();
    expect(entered).toEqual(["review"]);
    expect(lifecycle).toHaveBeenCalledWith({ context: { attempts: 0 } });
  });

  it("merges per-mount context overrides and keeps Providers independent", async () => {
    const bundle = makeBundle();
    const Attempts = ({ testId }: { testId: string }) => {
      const attempts = bundle.useSelector((snapshot) => snapshot.context.attempts);
      return <span data-testid={testId}>{attempts}</span>;
    };
    render(
      <>
        <bundle.Provider views={views} context={{ attempts: 7 }}>
          <Attempts testId="first" />
        </bundle.Provider>
        <bundle.Provider views={views}>
          <Attempts testId="second" />
        </bundle.Provider>
      </>
    );
    await flush();
    expect(screen.getByTestId("first").textContent).toBe("7");
    expect(screen.getByTestId("second").textContent).toBe("0");
  });

  it("honours autoStart=false (fallback until started via machineRef)", async () => {
    const bundle = makeBundle();
    const machineRef = React.createRef<ReturnType<typeof bundle.useMachine>>();
    render(
      <bundle.Provider views={views} autoStart={false} machineRef={machineRef as never}>
        <bundle.StepRenderer fallback={<span data-testid="fallback">waiting</span>} />
      </bundle.Provider>
    );
    await flush();
    expect(screen.getByTestId("fallback")).toBeTruthy();

    await act(async () => {
      machineRef.current!.controls.start();
    });
    await flush();
    expect(screen.getByTestId("step-form")).toBeTruthy();
  });

  it("disposes the per-mount machine on unmount and guards hooks outside the Provider", async () => {
    const bundle = makeBundle();
    const machineRef = React.createRef<ReturnType<typeof bundle.useMachine>>();
    const view = render(
      <bundle.Provider views={views} machineRef={machineRef as never}>
        <bundle.StepRenderer />
      </bundle.Provider>
    );
    await flush();
    const machine = machineRef.current!;
    view.unmount();
    await flush();
    expect(await machine.send("SUBMIT")).toEqual({ ok: false, reason: "disposed" });

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const Lost = () => {
      bundle.useSnapshot();
      return null;
    };
    expect(() => render(<Lost />)).toThrow(/inside this bundle's <Provider>/);
    consoleError.mockRestore();
  });
});

describe("graph bundle edges", () => {
  it("updates context through useApi and honours custom selector equality", async () => {
    const bundle = makeBundle();
    const seen: unknown[] = [];
    const kindSelector = (snapshot: { context: Ctx }) => ({ attempts: snapshot.context.attempts });
    const closeEnough = (a: { attempts: number }, b: { attempts: number }) =>
      Math.abs(a.attempts - b.attempts) < 10;
    const Probe = () => {
      const api = bundle.useApi();
      const stable = bundle.useSelector(kindSelector as never, closeEnough as never);
      seen.push(stable);
      return (
        <button onClick={() => api.updateContext((c) => ({ attempts: c.attempts + 1 }))}>
          bump
        </button>
      );
    };
    render(
      <bundle.Provider views={views}>
        <Probe />
      </bundle.Provider>
    );
    await flush();

    fireEvent.click(screen.getByText("bump"));
    await flush();
    const machineContexts = new Set(seen.map((value) => JSON.stringify(value)));
    expect(machineContexts.size).toBe(1); // equality collapsed the +1 change
  });

  it("supports function machineRefs with null cleanup and guards StepRenderer placement", async () => {
    const bundle = makeBundle();
    const seen: unknown[] = [];
    const view = render(
      <bundle.Provider views={views} machineRef={(machine) => void seen.push(machine)}>
        <bundle.StepRenderer />
      </bundle.Provider>
    );
    await flush();
    expect(seen[0]).not.toBeNull();
    view.unmount();
    await flush();
    expect(seen[seen.length - 1]).toBeNull();

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<bundle.StepRenderer />)).toThrow(/inside this bundle's <Provider>/);
    consoleError.mockRestore();
  });

  it("mounts exactly one machine under StrictMode", async () => {
    const bundle = makeBundle();
    const refs = new Set<unknown>();
    render(
      <React.StrictMode>
        <bundle.Provider
          views={views}
          machineRef={(machine) => {
            if (machine !== null) refs.add(machine);
          }}
        >
          <bundle.StepRenderer />
        </bundle.Provider>
      </React.StrictMode>
    );
    await flush();
    expect(refs.size).toBe(1);
    expect(screen.getByTestId("step-form")).toBeTruthy();
  });
});
