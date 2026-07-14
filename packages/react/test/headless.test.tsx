import { describe, expect, it, vi } from "vitest";

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";

import { createHeadlessJourney, createLinearJourney } from "@rxova/journey-core";
import {
  useJourneyComputed,
  useJourneyEvent,
  useJourneySelector,
  useJourneySnapshot,
  useJourneyStepLifecycle,
  useOwnedJourney,
  useStepAsyncState
} from "@rxova/journey-react/headless";

type Context = { count: number };
type StepId = "a" | "b" | "c";

const createMachine = () =>
  createLinearJourney<Context, StepId>({
    context: { count: 0 },
    steps: ["a", "b", "c"]
  });

describe("headless hooks", () => {
  it("useJourneySnapshot subscribes and re-renders on machine changes", async () => {
    const machine = createMachine();
    await machine.controls.start();

    const Probe = () => {
      const snapshot = useJourneySnapshot(machine);
      return <output data-testid="step">{snapshot.currentStepId}</output>;
    };

    render(<Probe />);
    expect(screen.getByTestId("step").textContent).toBe("a");

    await act(async () => {
      await machine.goToNextStep();
    });
    expect(screen.getByTestId("step").textContent).toBe("b");

    machine.dispose();
  });

  it("useJourneySelector re-renders only when the selected slice changes", async () => {
    const machine = createMachine();
    await machine.controls.start();
    let renders = 0;

    const Probe = () => {
      renders += 1;
      const count = useJourneySelector(machine, (snapshot) => snapshot.context.count);
      return <output data-testid="count">{count}</output>;
    };

    render(<Probe />);
    const rendersAfterMount = renders;

    // Navigation does not change context.count — no re-render.
    await act(async () => {
      await machine.goToNextStep();
    });
    expect(renders).toBe(rendersAfterMount);

    await act(async () => {
      await machine.updateContext((context) => ({ count: context.count + 1 }));
    });
    expect(screen.getByTestId("count").textContent).toBe("1");

    machine.dispose();
  });

  it("useJourneyComputed exposes linear wizard affordances", async () => {
    const machine = createMachine();
    await machine.controls.start();

    const Probe = () => {
      const computed = useJourneyComputed(machine);
      return (
        <output data-testid="computed">
          {computed.mode}:{String(computed.isFirstStep)}:{String(computed.stepCount)}
        </output>
      );
    };

    render(<Probe />);
    expect(screen.getByTestId("computed").textContent).toBe("linear:true:3");

    machine.dispose();
  });

  it("useJourneyEvent and useJourneyStepLifecycle observe navigation", async () => {
    const machine = createMachine();
    await machine.controls.start();
    const events: string[] = [];
    const entered: number[] = [];

    const Probe = () => {
      useJourneyEvent(machine, (event) => {
        events.push(event.type);
      });
      useJourneyStepLifecycle(machine, "b", {
        onEnter: ({ context }) => entered.push(context.count)
      });
      return null;
    };

    render(<Probe />);
    await act(async () => {
      await machine.goToNextStep();
    });

    expect(events).toContain("transition.success");
    expect(entered).toEqual([0]);

    machine.dispose();
  });

  it("useStepAsyncState tracks a step's async phase", async () => {
    const machine = createMachine();
    await machine.controls.start();

    const Probe = () => {
      const asyncState = useStepAsyncState(machine, "a");
      return <output data-testid="phase">{asyncState.phase}</output>;
    };

    render(<Probe />);
    expect(screen.getByTestId("phase").textContent).toBe("idle");

    machine.dispose();
  });

  it("works with headless core machines (graph-family snapshots)", async () => {
    const machine = createHeadlessJourney<Context, "watching" | "flagged">({
      initial: "watching",
      context: { count: 0 },
      steps: { watching: {}, flagged: {} }
    });
    await machine.controls.start();

    const Probe = () => {
      const snapshot = useJourneySnapshot(machine);
      return (
        <output data-testid="probe">
          {snapshot.type}:{snapshot.currentStepId}
        </output>
      );
    };

    render(<Probe />);
    expect(screen.getByTestId("probe").textContent).toBe("graph:watching");

    await act(async () => {
      await machine.goToStepById("flagged");
    });
    expect(screen.getByTestId("probe").textContent).toBe("graph:flagged");

    machine.dispose();
  });
});

describe("useOwnedJourney", () => {
  it("creates the machine exactly once under StrictMode and disposes on unmount", async () => {
    const factory = vi.fn(() => createMachine());
    const disposed: Array<ReturnType<typeof createMachine>> = [];

    const Owner = () => {
      const machine = useOwnedJourney(() => {
        const created = factory();
        const originalDispose = created.dispose;
        created.dispose = () => {
          disposed.push(created);
          originalDispose();
        };
        return created;
      });
      const snapshot = useJourneySnapshot(machine);
      return <output data-testid="owned">{snapshot.currentStepId}</output>;
    };

    const { unmount } = render(
      <React.StrictMode>
        <Owner />
      </React.StrictMode>
    );

    expect(factory).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("owned").textContent).toBe("a");

    unmount();
    await waitFor(() => {
      expect(disposed).toHaveLength(1);
    });
  });
});
