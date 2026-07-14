import { describe, expect, it, vi } from "vitest";

import {
  createJourneyMachine,
  JourneyDisposedError,
  JourneyStateError,
  type JourneyDefinition,
  type JourneyMachinePlugin
} from "@rxova/journey-core";

type StepId = "start" | "review" | "done";
type Context = { count: number };

const flushAsync = async () => {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};

const createJourney = (
  transitionHooks: Partial<{ onEnter: () => void; onLeave: () => void }> = {}
): JourneyDefinition<Context, StepId> => ({
  initial: "start",
  context: { count: 0 },
  steps: {
    start: {},
    review: {},
    done: {}
  },
  transitions: {
    start: {
      goToNextStep: [
        {
          to: "review",
          ...transitionHooks
        }
      ]
    },
    review: {
      goToNextStep: [{ to: "done" }],
      completeJourney: [{}]
    }
  }
});

describe("createJourneyMachine extra coverage", () => {
  it("runs transition-level lifecycle hooks", async () => {
    const onEnter = vi.fn();
    const onLeave = vi.fn();
    const machine = createJourneyMachine(createJourney({ onEnter, onLeave }));

    await machine.controls.start();
    await machine.goToNextStep();

    expect(onLeave).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "start",
        to: "review",
        transitionId: expect.any(String)
      })
    );
    expect(onEnter).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "start",
        to: "review",
        transitionId: expect.any(String)
      })
    );
  });

  it("returns disposed errors for previous and last-visited navigation after dispose", async () => {
    const machine = createJourneyMachine(createJourney());

    await machine.controls.start();
    machine.dispose();

    const previous = await machine.goToPreviousStep();
    const lastVisited = await machine.goToLastVisitedStep();

    expect(previous.error).toBeInstanceOf(JourneyDisposedError);
    expect(lastVisited.error).toBeInstanceOf(JourneyDisposedError);
  });

  it("stops lifecycle dispatch and thrown hook handling after disposal", async () => {
    let dispatchMachine: ReturnType<typeof createJourneyMachine<Context, StepId>>;
    dispatchMachine = createJourneyMachine({
      ...createJourney(),
      steps: {
        start: {},
        review: {
          onEnter: async ({ dispatch }) => {
            dispatchMachine.dispose();
            const result = await dispatch({ type: "goToNextStep" });
            expect(result.transitioned).toBe(false);
          }
        },
        done: {}
      }
    });
    await dispatchMachine.controls.start();
    await dispatchMachine.goToNextStep();
    await flushAsync();

    const hookCases: JourneyDefinition<Context, StepId>[] = [
      {
        ...createJourney(),
        steps: {
          start: {
            onLeave: () => {
              leaveMachine.dispose();
              throw new Error("disposed from step leave");
            }
          },
          review: {},
          done: {}
        }
      },
      createJourney({
        onLeave: () => {
          transitionLeaveMachine.dispose();
          throw new Error("disposed from transition leave");
        }
      }),
      {
        ...createJourney(),
        steps: {
          start: {},
          review: {
            onEnter: () => {
              enterMachine.dispose();
              throw new Error("disposed from step enter");
            }
          },
          done: {}
        }
      },
      createJourney({
        onEnter: () => {
          transitionEnterMachine.dispose();
          throw new Error("disposed from transition enter");
        }
      })
    ];

    let leaveMachine = createJourneyMachine(hookCases[0]!);
    let transitionLeaveMachine = createJourneyMachine(hookCases[1]!);
    let enterMachine = createJourneyMachine(hookCases[2]!);
    let transitionEnterMachine = createJourneyMachine(hookCases[3]!);

    for (const machine of [
      leaveMachine,
      transitionLeaveMachine,
      enterMachine,
      transitionEnterMachine
    ]) {
      await machine.controls.start();
      await machine.goToNextStep();
      await flushAsync();
      expect(machine.getSnapshot().status).toBe("running");
    }
  });

  it("rejects primitive transition definitions when provided", () => {
    expect(() =>
      createJourneyMachine({
        ...createJourney(),
        transitions: 1 as never
      })
    ).toThrow(/must be an array or an object map/i);
  });

  it("requires an initial step for graph-style journey definitions", () => {
    expect(() =>
      createJourneyMachine({
        context: { count: 0 },
        steps: {
          start: {},
          review: {}
        },
        transitions: {
          start: {
            goToNextStep: [{ to: "review" }]
          }
        }
      } as never)
    ).toThrow(/initial.*required/i);
  });

  it("rejects malformed graph transition fields during definition resolution", () => {
    const invalidEdges = [
      { to: 1 },
      { to: "review", onEnter: true },
      { to: "review", onLeave: true },
      { to: "review", label: 1 }
    ];

    for (const edge of invalidEdges) {
      expect(() =>
        createJourneyMachine({
          ...createJourney(),
          transitions: {
            start: {
              goToNextStep: [edge]
            }
          }
        } as never)
      ).toThrow();
    }
  });

  it("rejects duplicate and failing plugin devtools registrations", () => {
    const duplicateFeaturesPlugin: JourneyMachinePlugin = {
      name: "duplicate-features",
      setup: () => ({
        getDevtoolsFeatures: () => [
          { id: "duplicate", label: "Duplicate", operations: [] },
          { id: "duplicate", label: "Duplicate again", operations: [] }
        ]
      })
    };
    expect(() =>
      createJourneyMachine(createJourney(), { plugins: [duplicateFeaturesPlugin] as const })
    ).toThrow(/feature "duplicate" is already registered/);

    let stateError: unknown;
    try {
      createJourneyMachine(createJourney(), { plugins: [duplicateFeaturesPlugin] as const });
    } catch (error) {
      stateError = error;
    }
    expect(stateError).toBeInstanceOf(JourneyStateError);
    expect((stateError as JourneyStateError).code).toBe("duplicate-registration");

    const duplicateOperationsPlugin: JourneyMachinePlugin = {
      name: "duplicate-operations",
      setup: () => ({
        getDevtoolsFeatures: () => [
          {
            id: "feature-a",
            label: "Feature A",
            operations: [
              {
                id: "operation.same",
                label: "same",
                mutates: false,
                output: "void",
                run: async () => ({ kind: "void" })
              }
            ]
          },
          {
            id: "feature-b",
            label: "Feature B",
            operations: [
              {
                id: "operation.same",
                label: "same again",
                mutates: false,
                output: "void",
                run: async () => ({ kind: "void" })
              }
            ]
          }
        ]
      })
    };
    expect(() =>
      createJourneyMachine(createJourney(), { plugins: [duplicateOperationsPlugin] as const })
    ).toThrow(/operation "operation\.same" is already registered/);

    const failingPlugin: JourneyMachinePlugin = {
      name: "failing-devtools",
      setup: () => ({
        getDevtoolsFeatures: () => {
          throw "boom";
        }
      })
    };
    expect(() =>
      createJourneyMachine(createJourney(), { plugins: [failingPlugin] as const })
    ).toThrow(/plugin "failing-devtools" devtools registration failed: boom/i);

    const failingErrorPlugin: JourneyMachinePlugin = {
      name: "failing-devtools-error",
      setup: () => ({
        getDevtoolsFeatures: () => {
          throw new Error("error boom");
        }
      })
    };
    expect(() =>
      createJourneyMachine(createJourney(), { plugins: [failingErrorPlugin] as const })
    ).toThrow(/plugin "failing-devtools-error" devtools registration failed: error boom/i);
  });
});
