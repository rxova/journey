import React from "react";
import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { LinearJourney } from "@rxova/journey-react";
import { flush, makeStep, memoryStorage } from "@rxova/journey-react/testing";
import type { LinearJourneyMachine, LinearJourneySnapshot } from "@rxova/journey-react";

const StepA = makeStep("a");
const StepB = makeStep("b");

type Captured = { current: LinearJourneyMachine<{ n: number }, "a" | "b"> | null };

const capture = (captured: Captured) => (machine: unknown) => {
  captured.current = machine as Captured["current"];
};

describe("<LinearJourney> options prop", () => {
  it("is frozen at mount: a changed options object neither rebuilds nor moves the machine", async () => {
    const captured: Captured = { current: null };
    const { rerender } = render(
      <LinearJourney context={{ n: 0 }} machineRef={capture(captured) as never}>
        <StepA id="a" />
        <StepB id="b" />
      </LinearJourney>
    );
    await flush();
    const first = captured.current;
    expect(screen.getByTestId("step-a")).toBeTruthy();

    rerender(
      <LinearJourney
        context={{ n: 0 }}
        options={{ startAt: "b", defaultTimeoutMs: 99 }}
        machineRef={capture(captured) as never}
      >
        <StepA id="a" />
        <StepB id="b" />
      </LinearJourney>
    );
    await flush();

    expect(captured.current).toBe(first);
    expect(screen.getByTestId("step-a")).toBeTruthy();
  });

  it("threads onListenerError through to the core machine", async () => {
    const reported: unknown[] = [];
    const captured: Captured = { current: null };
    render(
      <LinearJourney
        context={{ n: 0 }}
        options={{ onListenerError: (error) => reported.push(error) }}
        machineRef={capture(captured) as never}
      >
        <StepA id="a" />
        <StepB id="b" />
      </LinearJourney>
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
    const captured: Captured = { current: null };
    const journey = (onStart?: (snapshot: LinearJourneySnapshot<{ n: number }, never>) => void) => (
      <React.StrictMode>
        <LinearJourney
          context={{ n: 0 }}
          options={{ persist: { key: "wizard", storage } }}
          machineRef={capture(captured) as never}
          onStart={onStart as never}
        >
          <StepA id="a" />
          <StepB id="b" />
        </LinearJourney>
      </React.StrictMode>
    );

    const first = render(journey());
    await flush();
    await act(async () => {
      await captured.current?.navigate.goToNextStep();
      captured.current?.context.update(() => ({ n: 7 }));
    });
    first.unmount();
    await flush();

    const startSnapshots: LinearJourneySnapshot<{ n: number }, never>[] = [];
    render(journey((snapshot) => startSnapshots.push(snapshot)));
    await flush();

    expect(screen.getByTestId("step-b")).toBeTruthy();
    expect(startSnapshots).toHaveLength(1);
    expect(startSnapshots[0]?.currentStep.id).toBe("b");
    expect(startSnapshots[0]?.context).toEqual({ n: 7 });
    expect(startSnapshots[0]?.currentStep.isFirstTimeVisit).toBe(false);
  });
});
