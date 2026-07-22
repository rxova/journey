import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { createLinearJourney } from "@rxova/journey-react";
import { flush } from "@rxova/journey-react/testing";

type BoundaryProps = { children: React.ReactNode };
type BoundaryState = { message: string | null };

class Boundary extends React.Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { message: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  override render() {
    if (this.state.message !== null) {
      return <span data-testid="caught">{this.state.message}</span>;
    }
    return this.props.children;
  }
}

/** Silences React's expected error logging for a deliberate throw. */
const withSilencedErrors = async (run: () => Promise<void> | void) => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    await run();
  } finally {
    spy.mockRestore();
  }
};

describe("error boundaries", () => {
  it("lets a boundary catch a throwing step view without breaking the machine", async () => {
    const journey = createLinearJourney({ context: {}, steps: ["boom", "safe"] });
    const Exploding = () => {
      throw new Error("view exploded");
    };

    await withSilencedErrors(async () => {
      render(
        <Boundary>
          <journey.Provider views={{ boom: <Exploding />, safe: <span>safe</span> }}>
            <journey.StepRenderer />
          </journey.Provider>
        </Boundary>
      );
      await flush();
    });

    expect(screen.getByTestId("caught").textContent).toBe("view exploded");
    // The machine is unaffected by a rendering failure in one of its views: it
    // started, it is on its first step, and it still navigates.
    expect(journey.machine.getSnapshot().currentStep?.id).toBe("boom");
    await act(async () => {
      await journey.navigate.goToNextStep();
    });
    expect(journey.machine.getSnapshot().currentStep?.id).toBe("safe");
  });

  it("lets a boundary catch StepRenderer used outside its Provider", async () => {
    const journey = createLinearJourney({ context: {}, steps: ["a"] });

    await withSilencedErrors(async () => {
      render(
        <Boundary>
          <journey.StepRenderer />
        </Boundary>
      );
      await flush();
    });

    expect(screen.getByTestId("caught").textContent).toContain("must be rendered inside");
  });

  it("recovers when a boundary remounts the subtree after the throw", async () => {
    const journey = createLinearJourney({ context: {}, steps: ["a"] });
    let shouldThrow = true;
    const Flaky = () => {
      if (shouldThrow) throw new Error("first render only");
      return <span data-testid="recovered">ok</span>;
    };

    await withSilencedErrors(async () => {
      render(
        <Boundary>
          <journey.Provider views={{ a: <Flaky /> }}>
            <journey.StepRenderer />
          </journey.Provider>
        </Boundary>
      );
      await flush();
    });
    expect(screen.getByTestId("caught")).toBeTruthy();

    // A fresh mount of the same bundle works: nothing was left in a broken
    // state by the failed render, and the subscription did not leak.
    shouldThrow = false;
    render(
      <journey.Provider views={{ a: <Flaky /> }}>
        <journey.StepRenderer />
      </journey.Provider>
    );
    await flush();
    expect(screen.getByTestId("recovered")).toBeTruthy();
  });
});

describe("suspense", () => {
  it("renders a suspending step view through a Suspense fallback", async () => {
    const journey = createLinearJourney({ context: {}, steps: ["lazy"] });
    let resolveView: (() => void) | undefined;
    const ready = new Promise<void>((resolve) => {
      resolveView = resolve;
    });
    let settled = false;
    void ready.then(() => {
      settled = true;
    });

    const Suspending = () => {
      if (!settled) throw ready;
      return <span data-testid="loaded">loaded</span>;
    };

    render(
      <React.Suspense fallback={<span data-testid="pending">pending</span>}>
        <journey.Provider views={{ lazy: <Suspending /> }}>
          <journey.StepRenderer />
        </journey.Provider>
      </React.Suspense>
    );
    expect(screen.getByTestId("pending")).toBeTruthy();
    // The ordering that makes this work: the first pass renders StepRenderer's
    // fallback (the machine is idle, so no view is chosen and nothing
    // suspends), which lets the start effect commit; only the re-render that
    // follows picks the lazy view and suspends. A view can therefore suspend
    // without deadlocking the journey that decides whether to show it.
    expect(journey.machine.getSnapshot().currentStep?.id).toBe("lazy");

    await act(async () => {
      resolveView?.();
      await ready;
    });
    await flush();

    expect(screen.getByTestId("loaded")).toBeTruthy();
    // Suspending the view must not have stopped the journey from starting.
    expect(journey.machine.getSnapshot().currentStep?.id).toBe("lazy");
  });
});
