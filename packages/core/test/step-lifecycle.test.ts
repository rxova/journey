import { describe, expect, it, vi } from "vitest";

import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "s0" | "s1" | "s2";
type Context = { value: number };

const baseDefinition = (): JourneyDefinition<Context, StepId> => ({
  initial: "s0",
  context: { value: 0 },
  steps: { s0: {}, s1: {}, s2: {} },
  transitions: {
    s0: { goToNextStep: [{ to: "s1" }] },
    s1: { goToNextStep: [{ to: "s2" }] },
    s2: { completeJourney: [{}] }
  }
});

describe("step lifecycle callbacks (onEnter / onLeave)", () => {
  it("calls onEnter when transitioning into the step", async () => {
    const onEnter = vi.fn();
    const def = baseDefinition();
    def.steps.s1 = { onEnter };

    const machine = createJourneyMachine(def);
    await machine.controls.start();
    await machine.goToNextStep();

    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it("calls onLeave when transitioning out of a step", async () => {
    const onLeave = vi.fn();
    const def = baseDefinition();
    def.steps.s0 = { onLeave };

    const machine = createJourneyMachine(def);
    await machine.controls.start();
    await machine.goToNextStep();

    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("passes the current snapshot context to onEnter", async () => {
    const onEnter = vi.fn();
    const def = baseDefinition();
    def.steps.s1 = { onEnter };
    def.transitions = {
      s0: {
        goToNextStep: [
          {
            to: "s1",
            updateContext: ({ context }) => ({ ...context, value: 42 })
          }
        ]
      },
      s1: { goToNextStep: [{ to: "s2" }] },
      s2: { completeJourney: [{}] }
    };

    const machine = createJourneyMachine(def);
    await machine.controls.start();
    await machine.goToNextStep();

    expect(onEnter).toHaveBeenCalledWith(expect.objectContaining({ context: { value: 42 } }));
  });

  it("passes the current snapshot context to onLeave", async () => {
    const onLeave = vi.fn();
    const def = baseDefinition();
    def.steps.s0 = { onLeave };

    const machine = createJourneyMachine(def);
    await machine.controls.start();
    await machine.updateContext(() => ({ value: 7 }));
    await machine.goToNextStep();

    expect(onLeave).toHaveBeenCalledWith(expect.objectContaining({ context: { value: 7 } }));
  });

  it("does not let lifecycle callbacks mutate internal context through callback args", async () => {
    const def: JourneyDefinition<{ nested: { value: number } }, StepId> = {
      initial: "s0",
      context: {
        nested: { value: 1 }
      },
      steps: {
        s0: {},
        s1: {
          onEnter: ({ context }) => {
            context.nested.value = 99;
          }
        },
        s2: {}
      },
      transitions: {
        s0: { goToNextStep: [{ to: "s1" }] },
        s1: { goToNextStep: [{ to: "s2" }] },
        s2: { completeJourney: [{}] }
      }
    };

    const machine = createJourneyMachine(def);
    await machine.controls.start();
    await machine.goToNextStep();

    expect(machine.getSnapshot().context.nested.value).toBe(1);
  });

  it("does not throw when onEnter is not defined on the entered step", async () => {
    const def = baseDefinition();
    // s1 has no onEnter
    const machine = createJourneyMachine(def);
    await machine.controls.start();

    await expect(machine.goToNextStep()).resolves.toMatchObject({ transitioned: true });
  });

  it("does not throw when onLeave is not defined on the exited step", async () => {
    const def = baseDefinition();
    // s0 has no onLeave
    const machine = createJourneyMachine(def);
    await machine.controls.start();

    await expect(machine.goToNextStep()).resolves.toMatchObject({ transitioned: true });
  });

  it("does not call onEnter for unrelated steps during the same transition", async () => {
    const onEnterS0 = vi.fn();
    const onEnterS2 = vi.fn();
    const def = baseDefinition();
    def.steps.s0 = { onEnter: onEnterS0 };
    def.steps.s2 = { onEnter: onEnterS2 };

    const machine = createJourneyMachine(def);
    await machine.controls.start();
    await machine.goToNextStep(); // enters s1

    expect(onEnterS0).not.toHaveBeenCalled();
    expect(onEnterS2).not.toHaveBeenCalled();
  });

  it("does not call onLeave for unrelated steps during the same transition", async () => {
    const onLeaveS1 = vi.fn();
    const onLeaveS2 = vi.fn();
    const def = baseDefinition();
    def.steps.s1 = { onLeave: onLeaveS1 };
    def.steps.s2 = { onLeave: onLeaveS2 };

    const machine = createJourneyMachine(def);
    await machine.controls.start();
    await machine.goToNextStep(); // exits s0, not s1 or s2

    expect(onLeaveS1).not.toHaveBeenCalled();
    expect(onLeaveS2).not.toHaveBeenCalled();
  });

  it("does not call onEnter for the initial step when startJourney() is called", async () => {
    const onEnter = vi.fn();
    const def = baseDefinition();
    def.steps.s0 = { onEnter };

    const machine = createJourneyMachine(def);
    await machine.controls.start();

    // startJourney() emits journey.start, not step.enter — onEnter should not fire
    expect(onEnter).not.toHaveBeenCalled();
  });

  it("calls both onEnter and onLeave on the same step across successive transitions", async () => {
    const onEnter = vi.fn();
    const onLeave = vi.fn();
    const def = baseDefinition();
    def.steps.s1 = { onEnter, onLeave };

    const machine = createJourneyMachine(def);
    await machine.controls.start();
    await machine.goToNextStep(); // s0 → s1: onEnter(s1)
    await machine.goToNextStep(); // s1 → s2: onLeave(s1)

    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("fires onEnter and onLeave for each step across a multi-step sequence", async () => {
    const log: string[] = [];
    const def = baseDefinition();
    def.steps.s0 = {
      onLeave: () => {
        log.push("s0:leave");
      }
    };
    def.steps.s1 = {
      onEnter: () => {
        log.push("s1:enter");
      },
      onLeave: () => {
        log.push("s1:leave");
      }
    };
    def.steps.s2 = {
      onEnter: () => {
        log.push("s2:enter");
      }
    };

    const machine = createJourneyMachine(def);
    await machine.controls.start();
    await machine.goToNextStep(); // s0 → s1
    await machine.goToNextStep(); // s1 → s2

    expect(log).toEqual(["s0:leave", "s1:enter", "s1:leave", "s2:enter"]);
  });
});
