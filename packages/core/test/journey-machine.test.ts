import { describe, expect, it, vi } from "vitest";

import {
  createJourneyMachine,
  type JourneyDefinition,
  type JourneyObservationEvent
} from "@rxova/journey-core";
import { createExecutionPathsPlugin } from "@rxova/journey-core/execution-paths";

type StepId = "start" | "details" | "review" | "confirmExit";
type EventMap = { back: unknown; requestClose: unknown };
type Context = { dirty: boolean; count: number };
type Meta = { title: string };

const createJourney = (): JourneyDefinition<Context, StepId, EventMap, Meta> => ({
  initial: "start",
  context: { dirty: false, count: 0 },
  steps: {
    start: {
      meta: { title: "Start" }
    },
    details: {
      meta: { title: "Details" }
    },
    review: {
      meta: { title: "Review" }
    },
    confirmExit: { meta: { title: "Confirm exit" } }
  },
  transitions: {
    start: { goToNextStep: [{ label: "start-next", to: "details" }] },
    details: { goToNextStep: [{ label: "details-next", to: "review" }] },
    review: { completeJourney: [{ label: "submit-review" }] },
    global: {
      requestClose: [
        {
          label: "close-dirty",
          to: "confirmExit",
          when: ({ context }) => context.dirty
        }
      ],
      terminateJourney: [
        {
          label: "close-clean",
          when: ({ context }) => !context.dirty
        }
      ]
    }
  }
});

const createMachine = () => createJourneyMachine<Context, StepId, EventMap, Meta>(createJourney());

const createStartedMachine = async () => {
  const machine = createMachine();
  await machine.startJourney();
  return machine;
};

describe("createJourneyMachine", () => {
  it("builds snapshot shape at startup", () => {
    const machine = createMachine();
    const snapshot = machine.getSnapshot();

    expect(snapshot.status).toBe("idled");
    expect(snapshot.currentStepId).toBe("start");
    expect(snapshot.history.timeline).toEqual(["start"]);
    expect(snapshot.history.index).toBe(0);
    expect(snapshot.visited).toEqual({ start: true });
    expect(machine.getStepMeta("start")).toEqual({ title: "Start" });
  });

  it("wraps plugin setup failures with the plugin name", () => {
    expect(() =>
      createJourneyMachine(createJourney(), {
        plugins: [
          {
            name: "broken-plugin",
            setup: () => {
              throw new Error("setup blew up");
            }
          }
        ] as const
      })
    ).toThrow('Journey plugin "broken-plugin" setup failed: setup blew up');
  });

  it("stringifies non-Error plugin setup failures", () => {
    expect(() =>
      createJourneyMachine(createJourney(), {
        plugins: [
          {
            name: "string-plugin",
            setup: () => {
              throw "bad setup";
            }
          }
        ] as const
      })
    ).toThrow('Journey plugin "string-plugin" setup failed: bad setup');
  });

  it("keeps the snapshot unchanged when a plugin rejects startup", async () => {
    const machine = createJourneyMachine(createJourney(), {
      plugins: [
        {
          name: "start-guard",
          setup: () => ({
            onSnapshotChange: ({ reason }: { reason: string }) => {
              if (reason === "start") {
                throw new Error("start rejected");
              }
            }
          })
        }
      ] as const
    });

    await expect(machine.startJourney()).rejects.toThrow("start rejected");
    expect(machine.getSnapshot()).toMatchObject({
      status: "idled",
      currentStepId: "start",
      context: { dirty: false, count: 0 }
    });
  });

  it("keeps the snapshot unchanged when a plugin rejects a context update", async () => {
    const machine = createJourneyMachine(createJourney(), {
      plugins: [
        {
          name: "context-guard",
          setup: () => ({
            onSnapshotChange: ({ reason }: { reason: string }) => {
              if (reason === "context") {
                throw new Error("context rejected");
              }
            }
          })
        }
      ] as const
    });
    await machine.startJourney();

    await expect(
      machine.updateContext((context) => ({
        ...context,
        count: context.count + 1
      }))
    ).rejects.toThrow("context rejected");
    expect(machine.getSnapshot()).toMatchObject({
      status: "running",
      currentStepId: "start",
      context: { dirty: false, count: 0 }
    });
  });

  it("rejects invalid journey construction inputs", () => {
    expect(() =>
      createJourneyMachine({
        ...createJourney(),
        steps: null
      } as unknown as JourneyDefinition<Context, StepId, EventMap, Meta>)
    ).toThrow("Journey steps must be a record object.");

    expect(() =>
      createJourneyMachine({
        ...createJourney(),
        transitions: null
      } as unknown as JourneyDefinition<Context, StepId, EventMap, Meta>)
    ).toThrow("Journey transitions must be an array or an object map when provided.");
  });

  it("rejects reserved step ids", () => {
    expect(() =>
      createJourneyMachine({
        ...createJourney(),
        steps: {
          ...createJourney().steps,
          global: { meta: { title: "Reserved" } }
        }
      } as unknown as JourneyDefinition<Context, StepId, EventMap, Meta>)
    ).toThrow('Step id "global" is reserved and cannot be used as a step name.');
  });

  it("goToPreviousStep convenience API navigates backward without an explicit transition", async () => {
    const machine = await createStartedMachine();

    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });

    const result = await machine.goToPreviousStep();

    expect(result.transitioned).toBe(true);
    expect(machine.getSnapshot().currentStepId).toBe("details");
  });

  it("goToPreviousStep with n and goToLastVisitedStep work as navigation APIs", async () => {
    const machine = await createStartedMachine();

    await machine.goToNextStep();
    await machine.goToNextStep();

    await machine.goToPreviousStep(2);
    expect(machine.getSnapshot().currentStepId).toBe("start");

    await machine.goToLastVisitedStep();
    expect(machine.getSnapshot().currentStepId).toBe("review");
  });

  it("goToNextStep convenience API behaves like send(goToNextStep)", async () => {
    const machine = await createStartedMachine();

    const result = await machine.goToNextStep();

    expect(result.transitioned).toBe(true);
    expect(result.transitionId).toEqual(expect.any(String));
    expect(result.label).toBe("start-next");
    expect(machine.getSnapshot().currentStepId).toBe("details");
  });

  it("completeJourney convenience API behaves like send(completeJourney)", async () => {
    const machine = await createStartedMachine();

    await machine.goToNextStep();
    await machine.goToNextStep();
    const result = await machine.completeJourney();

    expect(result.transitioned).toBe(true);
    expect(result.transitionId).toEqual(expect.any(String));
    expect(result.label).toBe("submit-review");
    expect(machine.getSnapshot().status).toBe("completed");
  });

  it("terminateJourney convenience API behaves like send(terminateJourney)", async () => {
    const machine = await createStartedMachine();

    const result = await machine.terminateJourney();

    expect(result.transitioned).toBe(true);
    expect(result.transitionId).toEqual(expect.any(String));
    expect(result.label).toBe("close-clean");
    expect(machine.getSnapshot().status).toBe("terminated");
  });

  it("forwards payloads through terminal convenience APIs", async () => {
    const payload = { source: "test" };
    const completeMachine = await createStartedMachine();

    await completeMachine.goToNextStep();
    await completeMachine.goToNextStep();
    const completeSpy = vi.spyOn(completeMachine, "send");

    await completeMachine.completeJourney(payload);

    expect(completeSpy).toHaveBeenLastCalledWith({
      type: "completeJourney",
      payload
    });

    const terminateJourney = await createStartedMachine();
    const terminateSpy = vi.spyOn(terminateJourney, "send");

    await terminateJourney.terminateJourney(payload);

    expect(terminateSpy).toHaveBeenLastCalledWith({
      type: "terminateJourney",
      payload
    });
  });

  it("enumerates execution paths from the initial step", () => {
    const executionPathJourney: JourneyDefinition<Context, StepId> = {
      initial: "start",
      context: { dirty: false, count: 0 },
      steps: {
        start: {
          meta: { title: "Start" }
        },
        details: {
          meta: { title: "Details" }
        },
        review: {
          meta: { title: "Review" }
        },
        confirmExit: { meta: { title: "Confirm exit" } }
      },
      transitions: {
        start: { goToNextStep: [{ label: "start-next", to: "details" }] },
        details: { goToNextStep: [{ label: "details-next", to: "review" }] },
        review: { completeJourney: [{ label: "submit-review" }] }
      }
    };
    const machine = createJourneyMachine(executionPathJourney, {
      plugins: [createExecutionPathsPlugin()] as const
    });

    expect(machine.getExecutionPaths()).toEqual({
      paths: [
        {
          steps: ["start", "details", "review"],
          events: ["goToNextStep", "goToNextStep", "completeJourney"],
          terminated: "final"
        }
      ],
      truncated: false,
      cyclesDetected: false
    });
  });

  it("marks cycles and respects maxDepth/maxPaths when enumerating execution paths", () => {
    const journey: JourneyDefinition<Context, StepId, EventMap, Meta> = {
      initial: "start",
      context: { dirty: false, count: 0 },
      steps: {
        start: {
          meta: { title: "Start" }
        },
        details: {
          meta: { title: "Details" }
        },
        review: {
          meta: { title: "Review" }
        },
        confirmExit: { meta: { title: "Confirm exit" } }
      },
      transitions: {
        start: {
          goToNextStep: [{ to: "details" }, { to: "review" }]
        },
        details: {
          goToNextStep: [{ to: "start" }]
        },
        review: {
          goToNextStep: [{ to: "confirmExit" }]
        },
        confirmExit: {
          goToNextStep: [{ to: "details" }]
        }
      }
    };

    const machine = createJourneyMachine(journey, {
      plugins: [createExecutionPathsPlugin()] as const
    });

    expect(machine.getExecutionPaths({ maxDepth: 2, maxPaths: 1 })).toEqual({
      paths: [
        {
          steps: ["start", "details", "start"],
          events: ["goToNextStep", "goToNextStep"],
          terminated: "cycle"
        }
      ],
      truncated: true,
      cyclesDetected: true
    });

    expect(machine.getExecutionPaths({ maxDepth: 3 })).toEqual({
      paths: [
        {
          steps: ["start", "details", "start"],
          events: ["goToNextStep", "goToNextStep"],
          terminated: "cycle"
        },
        {
          steps: ["start", "review", "confirmExit", "details"],
          events: ["goToNextStep", "goToNextStep", "goToNextStep"],
          terminated: "depth"
        }
      ],
      truncated: true,
      cyclesDetected: true
    });
  });

  it("emits transition and step lifecycle events in deterministic order", async () => {
    const machine = createMachine();
    const events: JourneyObservationEvent<StepId, EventMap>[] = [];

    const unsubscribe = machine.subscribeEvent((event) => {
      events.push(event);
    });

    await machine.startJourney();
    await machine.send({ type: "goToNextStep" });
    unsubscribe();

    expect(events.map((event) => event.type)).toEqual([
      "journey.start",
      "transition.start",
      "step.exit",
      "transition.success",
      "step.enter"
    ]);
    expect(events[0]).toMatchObject({ type: "journey.start", stepId: "start" });
    expect(events[1]).toMatchObject({ type: "transition.start", from: "start" });
    expect(events[3]).toMatchObject({
      type: "transition.success",
      from: "start",
      to: "details",
      transitionId: expect.any(String),
      label: "start-next"
    });
  });

  it("does not replay journey.start before the machine is explicitly started", async () => {
    const machine = createMachine();
    const events: JourneyObservationEvent<StepId, EventMap>[] = [];

    machine.subscribeEvent((event) => {
      events.push(event);
    });

    expect(events).toEqual([]);

    await machine.startJourney();

    expect(events).toEqual([
      {
        type: "journey.start",
        stepId: "start",
        timestamp: expect.any(Number)
      }
    ]);
  });

  it("subscribeStart filters to startup events", async () => {
    const machine = createMachine();
    const events: Array<{ stepId: StepId; timestamp: number }> = [];

    machine.subscribeStart((event) => {
      events.push({ stepId: event.stepId, timestamp: event.timestamp });
    });

    await machine.startJourney();
    await machine.goToNextStep();

    expect(events).toEqual([
      {
        stepId: "start",
        timestamp: expect.any(Number)
      }
    ]);
  });

  it("subscribeReset filters to reset events and respects unsubscribe", async () => {
    const machine = await createStartedMachine();
    const events: Array<{ stepId: StepId; timestamp: number }> = [];
    const unsubscribe = machine.subscribeReset((event) => {
      events.push({ stepId: event.stepId, timestamp: event.timestamp });
    });

    await machine.resetJourney();

    expect(events).toEqual([
      {
        stepId: "start",
        timestamp: expect.any(Number)
      }
    ]);

    unsubscribe();
    await machine.startJourney();
    await machine.resetJourney();

    expect(events).toHaveLength(1);
  });

  it("emits lifecycle.error events and calls onLifecycleError when lifecycle handlers throw", async () => {
    const onLifecycleError = vi.fn();
    const machine = createJourneyMachine<Context, StepId, EventMap, Meta>(
      {
        ...createJourney(),
        steps: {
          ...createJourney().steps,
          details: {
            meta: { title: "Details" },
            onEnter: async () => {
              throw new Error("details enter failed");
            }
          }
        }
      },
      { onLifecycleError }
    );
    const events: JourneyObservationEvent<StepId, EventMap>[] = [];

    machine.subscribeEvent((event) => {
      events.push(event);
    });

    await machine.startJourney();
    await machine.goToNextStep();
    await Promise.resolve();
    await Promise.resolve();

    expect(machine.getSnapshot().currentStepId).toBe("details");
    expect(onLifecycleError).toHaveBeenCalledTimes(1);
    expect(onLifecycleError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "details enter failed" }),
      expect.objectContaining({
        phase: "step.onEnter",
        from: "start",
        to: "details",
        eventType: "goToNextStep",
        transitionId: expect.any(String),
        label: "start-next"
      })
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "lifecycle.error",
        phase: "step.onEnter",
        from: "start",
        to: "details",
        eventType: "goToNextStep",
        transitionId: expect.any(String),
        label: "start-next",
        error: expect.objectContaining({ message: "details enter failed" })
      })
    );
  });

  it("reports step.onLeave lifecycle failures", async () => {
    const onLifecycleError = vi.fn();
    const machine = createJourneyMachine<Context, StepId, EventMap, Meta>(
      {
        ...createJourney(),
        steps: {
          ...createJourney().steps,
          start: {
            meta: { title: "Start" },
            onLeave: async () => {
              throw new Error("start leave failed");
            }
          }
        }
      },
      { onLifecycleError }
    );
    const events: JourneyObservationEvent<StepId, EventMap>[] = [];

    machine.subscribeEvent((event) => {
      events.push(event);
    });

    await machine.startJourney();
    await machine.goToNextStep();
    await Promise.resolve();
    await Promise.resolve();

    expect(onLifecycleError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "start leave failed" }),
      expect.objectContaining({
        phase: "step.onLeave",
        from: "start",
        to: "details",
        eventType: "goToNextStep",
        transitionId: expect.any(String),
        label: "start-next"
      })
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "lifecycle.error",
        phase: "step.onLeave",
        from: "start",
        to: "details",
        eventType: "goToNextStep",
        transitionId: expect.any(String),
        label: "start-next",
        error: expect.objectContaining({ message: "start leave failed" })
      })
    );
  });

  it("reports transition lifecycle failures for onLeave and onEnter", async () => {
    const onLifecycleError = vi.fn();
    const machine = createJourneyMachine<Context, StepId, EventMap, Meta>(
      {
        ...createJourney(),
        transitions: {
          ...createJourney().transitions,
          start: {
            goToNextStep: [
              {
                label: "start-next",
                to: "details",
                onLeave: async () => {
                  throw new Error("transition leave failed");
                }
              }
            ]
          },
          details: {
            goToNextStep: [
              {
                label: "details-next",
                to: "review",
                onEnter: async () => {
                  throw new Error("transition enter failed");
                }
              }
            ]
          }
        }
      },
      { onLifecycleError }
    );
    const events: JourneyObservationEvent<StepId, EventMap>[] = [];

    machine.subscribeEvent((event) => {
      events.push(event);
    });

    await machine.startJourney();
    await machine.goToNextStep();
    await Promise.resolve();
    await Promise.resolve();
    await machine.goToNextStep();
    await Promise.resolve();
    await Promise.resolve();

    expect(onLifecycleError).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ message: "transition leave failed" }),
      expect.objectContaining({
        phase: "transition.onLeave",
        from: "start",
        to: "details",
        eventType: "goToNextStep",
        transitionId: expect.any(String),
        label: "start-next"
      })
    );
    expect(onLifecycleError).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ message: "transition enter failed" }),
      expect.objectContaining({
        phase: "transition.onEnter",
        from: "details",
        to: "review",
        eventType: "goToNextStep",
        transitionId: expect.any(String),
        label: "details-next"
      })
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "lifecycle.error",
        phase: "transition.onLeave",
        error: expect.objectContaining({ message: "transition leave failed" })
      })
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "lifecycle.error",
        phase: "transition.onEnter",
        error: expect.objectContaining({ message: "transition enter failed" })
      })
    );
  });

  it("returns detached step metadata copies", () => {
    const machine = createMachine();
    const before = machine.getStepMeta("details");
    const after = machine.getStepMeta("details");

    expect(before).toEqual({ title: "Details" });
    expect(after).toEqual({ title: "Details" });
    expect(after).not.toBe(before);
  });

  it("subscribeComplete filters to terminal completion events", async () => {
    const machine = await createStartedMachine();
    const events: Array<{ stepId: StepId; timestamp: number }> = [];

    machine.subscribeComplete((event) => {
      events.push({ stepId: event.stepId, timestamp: event.timestamp });
    });

    await machine.goToNextStep();
    await machine.goToNextStep();

    expect(events).toEqual([]);

    await machine.completeJourney();

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      stepId: "review",
      timestamp: expect.any(Number)
    });
  });

  it("subscribeTerminate filters to terminal close events and respects unsubscribe", async () => {
    const machine = await createStartedMachine();
    const events: Array<{ stepId: StepId; timestamp: number }> = [];
    const unsubscribe = machine.subscribeTerminate((event) => {
      events.push({ stepId: event.stepId, timestamp: event.timestamp });
    });

    unsubscribe();
    await machine.terminateJourney();

    expect(events).toEqual([]);

    const activeMachine = await createStartedMachine();
    const activeEvents: Array<{ stepId: StepId; timestamp: number }> = [];
    activeMachine.subscribeTerminate((event) => {
      activeEvents.push({ stepId: event.stepId, timestamp: event.timestamp });
    });

    await activeMachine.terminateJourney();

    expect(activeEvents).toHaveLength(1);
    expect(activeEvents[0]).toEqual({
      stepId: "start",
      timestamp: expect.any(Number)
    });
  });

  it("subscribeSelector notifies only when selected value changes", async () => {
    const machine = await createStartedMachine();
    const calls: Array<{ next: StepId; previous: StepId }> = [];

    const unsubscribe = machine.subscribeSelector(
      (snapshot) => snapshot.currentStepId,
      (next, previous) => {
        calls.push({ next, previous });
      }
    );

    expect(calls).toEqual([]);

    machine.updateContext((context) => ({ ...context, count: context.count + 1 }));
    expect(calls).toEqual([]);

    await machine.goToNextStep();
    expect(calls).toEqual([{ next: "details", previous: "start" }]);

    machine.updateContext((context) => ({ ...context, count: context.count + 1 }));
    expect(calls).toEqual([{ next: "details", previous: "start" }]);

    unsubscribe();
    await machine.goToNextStep();
    expect(calls).toEqual([{ next: "details", previous: "start" }]);
  });

  it("subscribeSelector supports custom equality for derived object values", async () => {
    const machine = await createStartedMachine();
    const calls: Array<{ next: { step: StepId }; previous: { step: StepId } }> = [];

    machine.subscribeSelector(
      (snapshot) => ({ step: snapshot.currentStepId }),
      (next, previous) => {
        calls.push({ next, previous });
      },
      (previous, next) => previous.step === next.step
    );

    machine.updateContext((context) => ({ ...context, count: context.count + 1 }));
    expect(calls).toEqual([]);

    await machine.goToNextStep();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.previous.step).toBe("start");
    expect(calls[0]?.next.step).toBe("details");
  });

  it("blocks pointer moves once terminal unless reset", async () => {
    const machine = await createStartedMachine();

    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "goToNextStep" });
    await machine.send({ type: "completeJourney" });

    expect(machine.getSnapshot().status).toBe("completed");

    const next = await machine.goToNextStep();
    const prev = await machine.goToPreviousStep();
    const last = await machine.goToLastVisitedStep();

    expect(next.transitioned).toBe(false);
    expect(prev.transitioned).toBe(false);
    expect(last.transitioned).toBe(false);

    await machine.resetJourney();
    expect(machine.getSnapshot().status).toBe("idled");
    expect(machine.getSnapshot().currentStepId).toBe("start");
  });
});
