import { describe, expect, it, vi } from "vitest";

import React from "react";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";

import {
  createWizard,
  useWizard,
  useWizardSelector,
  useWizardStep,
  Wizard
} from "@rxova/journey-react";
import {
  useJourneySelector,
  useJourneyStepLifecycle,
  useOwnedJourney
} from "@rxova/journey-react/headless";
import { createLinearJourney } from "@rxova/journey-core";
import type { LinearJourneyMachine } from "@rxova/journey-core";

type Ctx = { count: number };

const initialContext: Ctx = { count: 0 };

const A = () => <output data-testid="panel">A</output>;
const B = () => <output data-testid="panel">B</output>;
const C = () => <output data-testid="panel">C</output>;

const Nav = () => {
  const { goToNextStep, goToPreviousStep, activeStepId } = useWizard<Ctx>();
  return (
    <nav>
      <output data-testid="active">{activeStepId}</output>
      <button data-testid="next" onClick={() => void goToNextStep()}>
        next
      </button>
      <button data-testid="back" onClick={() => void goToPreviousStep()}>
        back
      </button>
    </nav>
  );
};

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("wizard guard rails", () => {
  it("useWizard/useWizardSelector/useWizardStep throw outside <Wizard>", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useWizard())).toThrowError(/inside a <Wizard>/);
    expect(() => renderHook(() => useWizardSelector((s) => s.currentStepId))).toThrowError(
      /inside a <Wizard>/
    );
    expect(() => renderHook(() => useWizardStep())).toThrowError(/inside a <Wizard>/);
    consoleError.mockRestore();
  });

  it("useWizardStep outside a rendered step (e.g. header) throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const HeaderMisuse = () => {
      useWizardStep();
      return null;
    };
    expect(() =>
      render(
        <Wizard context={initialContext} header={<HeaderMisuse />}>
          <A id="a" />
        </Wizard>
      )
    ).toThrowError(/step component rendered by <Wizard>/);
    consoleError.mockRestore();
  });

  it("<Wizard.Step> rendered on its own renders nothing", () => {
    const { container } = render(
      <Wizard.Step id="lonely">
        <A />
      </Wizard.Step>
    );
    expect(container.innerHTML).toBe("");
  });

  it("rejects non-element children, missing Wizard.Step ids, and empty steps objects", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Wizard context={initialContext}>plain text</Wizard>)).toThrowError(
      /must be step elements/
    );

    expect(() =>
      render(
        <Wizard context={initialContext}>
          <Wizard.Step id="">
            <A />
          </Wizard.Step>
        </Wizard>
      )
    ).toThrowError(/missing its mandatory "id"/);

    expect(() => render(<Wizard context={initialContext} steps={{}} />)).toThrowError(
      /at least one step/
    );
    consoleError.mockRestore();
  });

  it("flattens fragments and arrays in the children form", async () => {
    render(
      <Wizard context={initialContext} footer={<Nav />}>
        <>
          <A id="a" />
          {[<B id="b" key="b" />]}
        </>
        <C id="c" />
      </Wizard>
    );
    await flush();

    fireEvent.click(screen.getByTestId("next"));
    await flush();
    expect(screen.getByTestId("active").textContent).toBe("b");
    fireEvent.click(screen.getByTestId("next"));
    await flush();
    expect(screen.getByTestId("active").textContent).toBe("c");
  });

  it("rejects out-of-range startIndex and unknown startStepId", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() =>
      render(
        <Wizard context={initialContext} startIndex={5}>
          <A id="a" />
        </Wizard>
      )
    ).toThrowError(/out of range/);

    expect(() =>
      render(
        <Wizard context={initialContext} startStepId="nope">
          <A id="a" />
        </Wizard>
      )
    ).toThrowError(/does not exist in the steps array/);
    consoleError.mockRestore();
  });

  it("strips the wizard id before rendering — components never receive it", async () => {
    const receivedProps: Record<string, unknown>[] = [];
    const Echo = (props: Record<string, unknown>) => {
      receivedProps.push(props);
      return <output data-testid="panel">echo</output>;
    };

    render(
      <Wizard context={initialContext}>
        <Echo id="echo-step" data-extra="kept" />
      </Wizard>
    );
    await flush();

    expect(screen.getByTestId("panel").textContent).toBe("echo");
    expect(receivedProps.length).toBeGreaterThan(0);
    for (const props of receivedProps) {
      expect("id" in props).toBe(false);
      // Other props pass through untouched.
      expect(props["data-extra"]).toBe("kept");
    }
  });

  it("starts from startIndex and supports an object machineRef", async () => {
    const machineRef = React.createRef<LinearJourneyMachine<Ctx, string>>();
    render(
      <Wizard context={initialContext} startIndex={1} footer={<Nav />} machineRef={machineRef}>
        <A id="a" />
        <B id="b" />
        <C id="c" />
      </Wizard>
    );
    await flush();

    expect(screen.getByTestId("active").textContent).toBe("b");
    expect(machineRef.current?.getSnapshot().currentStepId).toBe("b");
  });
});

describe("useWizard escape hatches", () => {
  it("resetJourney, getStepMeta, goToStepById/ByIndex, and useWizardSelector work", async () => {
    const Probe = () => {
      const wizard = useWizard<Ctx>();
      const active = useWizardSelector((snapshot) => snapshot.currentStepId);
      return (
        <div>
          <output data-testid="selected">{active}</output>
          <output data-testid="metaB">{JSON.stringify(wizard.getStepMeta("b") ?? null)}</output>
          <button data-testid="byIndex" onClick={() => void wizard.goToStepByIndex(1)}>
            byIndex
          </button>
          <button data-testid="reset" onClick={() => void wizard.resetJourney()}>
            reset
          </button>
        </div>
      );
    };

    render(
      <Wizard
        context={initialContext}
        header={<Probe />}
        steps={{
          a: A,
          b: { component: B, meta: { label: "Bee" } },
          c: C
        }}
      />
    );
    await flush();

    expect(JSON.parse(screen.getByTestId("metaB").textContent ?? "null")).toEqual({
      label: "Bee"
    });

    fireEvent.click(screen.getByTestId("byIndex"));
    await flush();
    expect(screen.getByTestId("selected").textContent).toBe("b");

    fireEvent.click(screen.getByTestId("reset"));
    await flush();
    expect(screen.getByTestId("selected").textContent).toBe("a");
  });
});

describe("dynamic step edge cases", () => {
  it("falls back to the nearest surviving step when the active step is removed", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const Host = () => {
      const [withB, setWithB] = React.useState(true);
      return (
        <div>
          <button data-testid="dropB" onClick={() => setWithB(false)}>
            drop
          </button>
          <Wizard context={initialContext} footer={<Nav />}>
            <A id="a" />
            {withB && <B id="b" />}
            <C id="c" />
          </Wizard>
        </div>
      );
    };

    render(<Host />);
    await flush();
    fireEvent.click(screen.getByTestId("next"));
    await flush();
    expect(screen.getByTestId("active").textContent).toBe("b");

    fireEvent.click(screen.getByTestId("dropB"));
    await flush();

    // Active step "b" was removed; the wizard falls back within surviving history.
    expect(screen.getByTestId("active").textContent).toBe("a");
    warn.mockRestore();
  });
});

describe("createWizard bundle extras", () => {
  it("bundle useWizardSelector and useWizardStep run against the bundle Wizard", async () => {
    const bundle = createWizard({
      context: initialContext,
      steps: { a: A, b: B }
    });

    const intercepted: string[] = [];
    const StepA = () => {
      bundle.useWizardStep(() => {
        intercepted.push("a");
      });
      return <output data-testid="panel">A</output>;
    };

    const Probe = () => {
      const active = bundle.useWizardSelector((snapshot) => snapshot.currentStepId);
      const { goToNextStep } = bundle.useWizard();
      return (
        <div>
          <output data-testid="active">{active}</output>
          <button data-testid="next" onClick={() => void goToNextStep()}>
            next
          </button>
        </div>
      );
    };

    const withStepA = createWizard({
      context: initialContext,
      steps: { a: StepA, b: B }
    });
    void bundle;

    render(<withStepA.Wizard header={<Probe />} />);
    await flush();

    fireEvent.click(screen.getByTestId("next"));
    await flush();
    expect(intercepted).toEqual(["a"]);
    expect(screen.getByTestId("active").textContent).toBe("b");
  });
});

describe("headless branch coverage", () => {
  it("useJourneyStepLifecycle fires onLeave; useJourneySelector honors a custom equalityFn", async () => {
    const left: string[] = [];
    const Probe = () => {
      const machine = useOwnedJourney(() =>
        createLinearJourney<Ctx, "x" | "y">({ context: { count: 0 }, steps: ["x", "y"] })
      );
      useJourneyStepLifecycle(machine, "x", {
        onLeave: () => void left.push("x")
      });
      const bucket = useJourneySelector(
        machine,
        (snapshot) => ({ step: snapshot.currentStepId }),
        (previous, next) => previous.step === next.step
      );
      return (
        <div>
          <output data-testid="bucket">{bucket.step}</output>
          <button
            data-testid="go"
            onClick={() => {
              void machine.startJourney().then(() => machine.goToNextStep());
            }}
          >
            go
          </button>
        </div>
      );
    };

    render(<Probe />);
    fireEvent.click(screen.getByTestId("go"));
    await flush();
    await flush();

    expect(left).toEqual(["x"]);
    expect(screen.getByTestId("bucket").textContent).toBe("y");
  });
});
