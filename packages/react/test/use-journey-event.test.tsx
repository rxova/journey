import { describe, expect, it, vi } from "vitest";

import React from "react";
import { act } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { createJourneyMachine } from "@rxova/journey-core";
import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "start" | "review";
type Event = "goToNextStep" | "terminateJourney" | "completeJourney";
type Context = { count: number };

const journey: JourneyReactDefinition<Context, StepId, Event> = {
  initial: "start",
  context: { count: 0 },
  steps: {
    start: { component: () => <div>start</div> },
    review: { component: () => <div>review</div> }
  },
  transitions: [{ from: "start", event: "goToNextStep", to: "review" }]
};

const bindings = createJourneyBindings(journey);

describe("useJourneyEvent", () => {
  it("subscribes to machine lifecycle events", async () => {
    const machine = createJourneyMachine(journey);
    const receivedTypes: string[] = [];

    const Listener = () => {
      bindings.useJourneyEvent((event) => {
        receivedTypes.push(event.type);
      });
      return null;
    };

    render(
      <bindings.Provider machine={machine}>
        <Listener />
      </bindings.Provider>
    );

    await act(async () => {
      await machine.goToNextStep();
    });

    expect(receivedTypes).toContain("transition.start");
    expect(receivedTypes).toContain("transition.success");
    expect(receivedTypes).toContain("step.exit");
    expect(receivedTypes).toContain("step.enter");
  });

  it("keeps one subscription across listener identity changes and cleans up on unmount", async () => {
    const machine = createJourneyMachine(journey);
    const baseSubscribeEvent = machine.subscribeEvent.bind(machine);
    let unsubscribeCalls = 0;
    const observedTicks: number[] = [];

    const subscribeEvent = vi.fn((...args: Parameters<typeof machine.subscribeEvent>) => {
      const unsubscribe = baseSubscribeEvent(...args);
      return () => {
        unsubscribeCalls += 1;
        unsubscribe();
      };
    });

    const instrumentedMachine = {
      ...machine,
      subscribeEvent
    };

    const Listener = ({ tick }: { tick: number }) => {
      bindings.useJourneyEvent((event) => {
        if (event.type === "transition.start") {
          observedTicks.push(tick);
        }
      });
      return null;
    };

    const Harness = () => {
      const [tick, setTick] = React.useState(0);
      return (
        <div>
          <button data-testid="rerender" onClick={() => setTick((value) => value + 1)}>
            rerender
          </button>
          <bindings.Provider machine={instrumentedMachine}>
            <Listener tick={tick} />
          </bindings.Provider>
        </div>
      );
    };

    const { unmount } = render(<Harness />);

    expect(subscribeEvent).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("rerender"));
    fireEvent.click(screen.getByTestId("rerender"));

    expect(subscribeEvent).toHaveBeenCalledTimes(1);

    await act(async () => {
      await machine.goToNextStep();
    });

    expect(observedTicks).toContain(2);

    unmount();

    expect(unsubscribeCalls).toBe(1);
  });
});
