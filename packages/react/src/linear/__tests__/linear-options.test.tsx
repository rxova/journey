import React from "react";
import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { createLinearJourney } from "@rxova/journey-react";
import { flush, makeStep, memoryStorage } from "@rxova/journey-react/testing";
import type { LinearJourneyMachine, LinearJourneySnapshot } from "@rxova/journey-react";

const StepA = makeStep("a");
const StepB = makeStep("b");

type Captured = { current: LinearJourneyMachine<{ n: number }, "a" | "b"> | null };

const capture = (captured: Captured) => (machine: unknown) => {
  captured.current = machine as Captured["current"];
};

describe("Provider mount-time freezing", () => {
  it("keeps one machine across rerenders, ignoring changed initialContext and startAt props", async () => {
    const journey = createLinearJourney({ context: { n: 0 }, steps: ["a", "b"] });
    const ShowN = () => {
      const n = journey.useSelector((snapshot) => snapshot.context.n);
      return <span data-testid="n">{n}</span>;
    };
    const captured: Captured = { current: null };
    const { rerender } = render(
      <journey.Provider
        views={{ a: <StepA />, b: <StepB /> }}
        initialContext={{ n: 1 }}
        machineRef={capture(captured) as never}
        footer={<ShowN />}
      />
    );
    await flush();
    const first = captured.current;
    expect(screen.getByTestId("step-a")).toBeTruthy();
    expect(screen.getByTestId("n").textContent).toBe("1");

    rerender(
      <journey.Provider
        views={{ a: <StepA />, b: <StepB /> }}
        initialContext={{ n: 99 }}
        startAt="b"
        machineRef={capture(captured) as never}
        footer={<ShowN />}
      />
    );
    await flush();

    expect(captured.current).toBe(first);
    expect(screen.getByTestId("step-a")).toBeTruthy();
    expect(screen.getByTestId("n").textContent).toBe("1");
  });

  it("threads onListenerError through to the core machine", async () => {
    const reported: unknown[] = [];
    const journey = createLinearJourney(
      { context: { n: 0 }, steps: ["a", "b"] },
      { onListenerError: (error: unknown) => reported.push(error) }
    );
    const captured: Captured = { current: null };
    render(
      <journey.Provider
        views={{ a: <StepA />, b: <StepB /> }}
        machineRef={capture(captured) as never}
      />
    );
    await flush();

    const failure = new Error("bad listener");
    captured.current?.subscriptions.subscribeEvent("stepEnter", () => {
      throw failure;
    });
    await act(async () => {
      await captured.current?.navigate.goToNextStep();
    });

    expect(reported).toEqual([failure]);
    expect(screen.getByTestId("step-b")).toBeTruthy();
  });

  it("persist restore resumes a remounted journey at the persisted step under StrictMode", async () => {
    const storage = memoryStorage();
    const journey = createLinearJourney(
      { context: { n: 0 }, steps: ["a", "b"] },
      { persist: { key: "wizard", storage } }
    );
    const captured: Captured = { current: null };
    const mounted = (
      onStart?: (snapshot: LinearJourneySnapshot<{ n: number }, "a" | "b">) => void
    ) => (
      <React.StrictMode>
        <journey.Provider
          views={{ a: <StepA />, b: <StepB /> }}
          machineRef={capture(captured) as never}
          {...(onStart !== undefined ? { onStart } : {})}
        />
      </React.StrictMode>
    );

    const first = render(mounted());
    await flush();
    await act(async () => {
      await captured.current?.navigate.goToNextStep();
      captured.current?.context.update(() => ({ n: 7 }));
    });
    first.unmount();
    await flush();

    const startSnapshots: LinearJourneySnapshot<{ n: number }, "a" | "b">[] = [];
    render(mounted((snapshot) => startSnapshots.push(snapshot)));
    await flush();

    expect(screen.getByTestId("step-b")).toBeTruthy();
    expect(startSnapshots).toHaveLength(1);
    expect(startSnapshots[0]?.currentStep.id).toBe("b");
    expect(startSnapshots[0]?.context).toEqual({ n: 7 });
    expect(startSnapshots[0]?.currentStep.isFirstTimeVisit).toBe(false);
  });
});
