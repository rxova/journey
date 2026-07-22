import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createLinearJourney, useJourney } from "@rxova/journey-react";
import { flush } from "@rxova/journey-react/testing";

const makeBundle = () => createLinearJourney({ context: { n: 0 }, steps: ["a", "b"] });

describe("useJourney", () => {
  it("creates exactly one bundle per component instance under StrictMode", async () => {
    const factory = vi.fn(makeBundle);
    const Wizard = () => {
      const journey = useJourney(factory);
      return <span data-testid="step">{journey.useStep()?.id ?? "idle"}</span>;
    };

    render(
      <React.StrictMode>
        <Wizard />
      </React.StrictMode>
    );
    await flush();

    // A useState lazy initializer would have run twice here and built two
    // fully-configured machines, abandoning one undisposed.
    expect(factory).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("step").textContent).toBe("a");
  });

  it("gives each mounted component its own machine", async () => {
    const Wizard = ({ marker }: { marker: string }) => {
      const journey = useJourney(makeBundle);
      return (
        <div>
          <span data-testid={`step-${marker}`}>{journey.useStep()?.id ?? "idle"}</span>
          <button onClick={() => void journey.navigate.goToNextStep()}>{`next-${marker}`}</button>
        </div>
      );
    };
    render(
      <React.StrictMode>
        <Wizard marker="one" />
        <Wizard marker="two" />
      </React.StrictMode>
    );
    await flush();

    fireEvent.click(screen.getByText("next-one"));
    await flush();
    expect(screen.getByTestId("step-one").textContent).toBe("b");
    expect(screen.getByTestId("step-two").textContent).toBe("a");
  });

  it("survives StrictMode's simulated unmount but disposes on a real one", async () => {
    const disposed: string[] = [];
    const factory = () => {
      const bundle = makeBundle();
      const realDispose = bundle.machine.dispose;
      bundle.machine.dispose = () => {
        disposed.push("yes");
        realDispose();
      };
      return bundle;
    };
    const Wizard = () => {
      const journey = useJourney(factory);
      return <span data-testid="step">{journey.useStep()?.id ?? "idle"}</span>;
    };

    const view = render(
      <React.StrictMode>
        <Wizard />
      </React.StrictMode>
    );
    await flush();
    // StrictMode already ran a mount/unmount/mount cycle; the deferred disposal
    // must have been cancelled by the remount.
    expect(disposed).toEqual([]);
    expect(screen.getByTestId("step").textContent).toBe("a");

    await act(async () => view.unmount());
    await flush();
    expect(disposed).toEqual(["yes"]);
  });

  it("keeps the same bundle across re-renders and ignores a changed factory", async () => {
    const seen: unknown[] = [];
    const Wizard = ({ tick }: { tick: number }) => {
      // A fresh factory closure every render — the first one still wins.
      const journey = useJourney(() => makeBundle());
      seen.push(journey);
      return <span data-testid="tick">{tick}</span>;
    };
    const view = render(<Wizard tick={0} />);
    await flush();
    view.rerender(<Wizard tick={1} />);
    view.rerender(<Wizard tick={2} />);

    expect(seen.length).toBe(3);
    expect(new Set(seen).size).toBe(1);
  });
});
