import { describe, expect, it, vi } from "vitest";

import React from "react";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";

import { createGraphJourney } from "@rxova/journey-react/graph";

type Ctx = { items: number };

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("graph tier", () => {
  it("creates one machine per Provider mount, renders views, and navigates", async () => {
    const bundle = createGraphJourney({
      initial: "cart",
      context: { items: 0 } as Ctx,
      steps: { cart: {}, shipping: {}, confirm: {} },
      transitions: {
        cart: { goToNextStep: [{ to: "shipping" }] },
        shipping: { goToNextStep: [{ to: "confirm" }] }
      }
    });

    const Cart = () => {
      const api = bundle.useApi();
      return (
        <button data-testid="next" onClick={() => void api.goToNextStep()}>
          cart
        </button>
      );
    };
    const Shipping = () => <output data-testid="view">shipping</output>;
    const Confirm = () => <output data-testid="view">confirm</output>;

    const Probe = () => {
      const snapshot = bundle.useSnapshot();
      return (
        <output data-testid="probe">
          {snapshot.type}:{snapshot.currentStepId}
        </output>
      );
    };

    render(
      <React.StrictMode>
        <bundle.Provider views={{ cart: Cart, shipping: Shipping, confirm: Confirm }}>
          <Probe />
          <bundle.StepRenderer fallback={<p>none</p>} />
        </bundle.Provider>
      </React.StrictMode>
    );
    await flush();

    expect(screen.getByTestId("probe").textContent).toBe("graph:cart");
    fireEvent.click(screen.getByTestId("next"));
    await flush();
    expect(screen.getByTestId("probe").textContent).toBe("graph:shipping");
    expect(screen.getByTestId("view").textContent).toBe("shipping");
  });

  it("two Providers of the same bundle are independent instances", async () => {
    const bundle = createGraphJourney({
      initial: "a",
      context: { items: 0 } as Ctx,
      steps: { a: {}, b: {} },
      transitions: { a: { goToNextStep: [{ to: "b" }] } }
    });

    const Step = ({ label }: { label: string }) => {
      const api = bundle.useApi();
      const snapshot = bundle.useSnapshot();
      return (
        <button data-testid={`btn-${label}`} onClick={() => void api.goToNextStep()}>
          {label}:{snapshot.currentStepId}
        </button>
      );
    };

    const A1 = () => <Step label="one" />;
    const A2 = () => <Step label="two" />;

    render(
      <div>
        <bundle.Provider views={{ a: A1, b: A1 }}>
          <bundle.StepRenderer />
        </bundle.Provider>
        <bundle.Provider views={{ a: A2, b: A2 }}>
          <bundle.StepRenderer />
        </bundle.Provider>
      </div>
    );
    await flush();

    fireEvent.click(screen.getByTestId("btn-one"));
    await flush();

    expect(screen.getByTestId("btn-one").textContent).toBe("one:b");
    expect(screen.getByTestId("btn-two").textContent).toBe("two:a");
  });

  it("supports per-mount context overrides, guards, and computed state", async () => {
    const bundle = createGraphJourney({
      initial: "cart",
      context: { items: 0 } as Ctx,
      steps: { cart: {}, shipping: {}, payment: {} },
      transitions: {
        cart: { goToNextStep: [{ to: "shipping" }] },
        shipping: {
          goToNextStep: [
            { to: "payment", when: ({ context }: { context: Ctx }) => context.items > 0 }
          ]
        }
      }
    });

    const Probe = () => {
      const api = bundle.useApi();
      const computed = bundle.useComputed();
      const items = bundle.useSelector((snapshot) => (snapshot.context as Ctx).items);
      return (
        <div>
          <output data-testid="state">
            {computed.mode}:{computed.activeStepId}:{items}
          </output>
          <button data-testid="next" onClick={() => void api.goToNextStep()}>
            next
          </button>
        </div>
      );
    };

    const NullView = () => null;
    render(
      <bundle.Provider
        views={{ cart: NullView, shipping: NullView, payment: NullView }}
        context={{ items: 2 }}
      >
        <Probe />
      </bundle.Provider>
    );
    await flush();

    expect(screen.getByTestId("state").textContent).toBe("graph:cart:2");
    fireEvent.click(screen.getByTestId("next"));
    await flush();
    fireEvent.click(screen.getByTestId("next"));
    await flush();
    // items: 2 passes the shipping guard.
    expect(screen.getByTestId("state").textContent).toBe("graph:payment:2");
  });

  it("useApi exposes pauseJourney/resumeJourney and useStepApi/useEvent/useStepLifecycle work", async () => {
    const bundle = createGraphJourney({
      initial: "a",
      context: { items: 0 } as Ctx,
      steps: { a: {}, b: {} },
      transitions: { a: { goToNextStep: [{ to: "b" }] } }
    });

    const events: string[] = [];
    const entered: string[] = [];

    const Probe = () => {
      const api = bundle.useApi();
      const stepApi = bundle.useStepApi("a");
      const asyncState = bundle.useStepAsyncState("a");
      bundle.useEvent((event) => void events.push(event.type));
      bundle.useStepLifecycle("b", { onEnter: () => void entered.push("b") });
      void stepApi;
      return (
        <div>
          <output data-testid="phase">{asyncState.phase}</output>
          <button data-testid="pause" onClick={() => api.pauseJourney()}>
            pause
          </button>
          <button data-testid="resume" onClick={() => api.resumeJourney()}>
            resume
          </button>
          <button data-testid="next" onClick={() => void api.goToNextStep()}>
            next
          </button>
        </div>
      );
    };

    const NullView = () => null;
    render(
      <bundle.Provider views={{ a: NullView, b: NullView }}>
        <Probe />
        <bundle.StepRenderer />
      </bundle.Provider>
    );
    await flush();

    expect(screen.getByTestId("phase").textContent).toBe("idle");

    fireEvent.click(screen.getByTestId("pause"));
    fireEvent.click(screen.getByTestId("next"));
    await flush();
    expect(entered).toEqual([]);

    fireEvent.click(screen.getByTestId("resume"));
    fireEvent.click(screen.getByTestId("next"));
    await flush();
    expect(entered).toEqual(["b"]);
    expect(events).toContain("journey.paused");
    expect(events).toContain("journey.resumed");
  });

  it("hooks throw outside the Provider and autoStart=false leaves the journey idle", async () => {
    const bundle = createGraphJourney({
      initial: "a",
      context: { items: 0 } as Ctx,
      steps: { a: {} },
      transitions: {}
    });

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => bundle.useApi())).toThrowError(/inside this bundle's <Provider>/);
    consoleError.mockRestore();

    const NullView = () => null;
    const Probe = () => {
      const snapshot = bundle.useSnapshot();
      return <output data-testid="status">{snapshot.status}</output>;
    };
    render(
      <bundle.Provider views={{ a: NullView }} autoStart={false}>
        <Probe />
      </bundle.Provider>
    );
    await flush();
    expect(screen.getByTestId("status").textContent).toBe("idled");
  });

  it("exposes the machine via machineRef and useMachine", async () => {
    const bundle = createGraphJourney({
      initial: "a",
      context: { items: 0 } as Ctx,
      steps: { a: {} },
      transitions: {}
    });

    const machineRef = React.createRef<unknown>();
    const NullView = () => null;
    const Probe = () => {
      const machine = bundle.useMachine();
      return <output data-testid="step">{machine.getSnapshot().currentStepId}</output>;
    };

    render(
      <bundle.Provider views={{ a: NullView }} machineRef={machineRef}>
        <Probe />
      </bundle.Provider>
    );
    await flush();

    expect(screen.getByTestId("step").textContent).toBe("a");
    expect(machineRef.current).not.toBeNull();
  });
});
