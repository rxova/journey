import { describe, expect, it } from "vitest";

import {
  createFlowMachine,
  FLOW_STATUS,
  HISTORY_TARGET,
  FLOW_TERMINAL,
  type FlowFlow
} from "@/src/core";

type StepId = "start" | "details" | "extra" | "review" | "confirmClose";
type Ctx = {
  addExtra: boolean;
  dirty: boolean;
  allowNext: boolean;
  count: number;
};
type Event = "next" | "back" | "close" | "submit";
const idleStepAsync = () => ({
  phase: "idle" as const,
  eventType: null,
  transitionId: null,
  error: null
});
const asyncState = () => ({
  isLoading: false,
  byStep: {
    start: idleStepAsync(),
    details: idleStepAsync(),
    extra: idleStepAsync(),
    review: idleStepAsync(),
    confirmClose: idleStepAsync()
  }
});

const baseFlow = (): FlowFlow<Ctx, StepId, Event> => ({
  initial: "start",
  context: {
    addExtra: false,
    dirty: false,
    allowNext: true,
    count: 0
  },
  steps: {
    start: {},
    details: {},
    extra: {},
    review: {},
    confirmClose: {}
  },
  transitions: [
    { id: "s->d", from: "start", event: "next", to: "details" },
    {
      id: "d->extra",
      from: "details",
      event: "next",
      to: "extra",
      when: ({ context }) => context.addExtra
    },
    {
      id: "d->review",
      from: "details",
      event: "next",
      to: "review",
      when: ({ context }) => !context.addExtra
    },
    { id: "extra->review", from: "extra", event: "next", to: "review" },
    {
      id: "back-history",
      from: "*",
      event: "back",
      to: HISTORY_TARGET
    },
    {
      id: "close-dirty",
      from: "*",
      event: "close",
      to: "confirmClose",
      when: ({ context }) => context.dirty
    },
    {
      id: "close-clean",
      from: "*",
      event: "close",
      to: FLOW_TERMINAL.CLOSE,
      when: ({ context }) => !context.dirty
    },
    {
      id: "submit",
      from: "review",
      event: "submit",
      to: FLOW_TERMINAL.COMPLETE
    }
  ]
});

describe("createFlowMachine", () => {
  it("creates initial snapshot", () => {
    const machine = createFlowMachine(baseFlow());

    expect(machine.getSnapshot()).toEqual({
      current: "start",
      context: {
        addExtra: false,
        dirty: false,
        allowNext: true,
        count: 0
      },
      history: [],
      visited: ["start"],
      status: FLOW_STATUS.RUNNING,
      async: asyncState()
    });
  });

  it("takes first matching transition", async () => {
    const machine = createFlowMachine(baseFlow());

    await machine.send({ type: "next" });
    await machine.send({ type: "next" });

    expect(machine.getSnapshot().current).toBe("review");
  });

  it("supports conditional branch to extra step", async () => {
    const machine = createFlowMachine(baseFlow());

    machine.updateContext((ctx) => ({ ...ctx, addExtra: true }));
    await machine.send({ type: "next" });
    await machine.send({ type: "next" });

    expect(machine.getSnapshot().current).toBe("extra");
  });

  it("uses history target for back", async () => {
    const machine = createFlowMachine(baseFlow());

    await machine.send({ type: "next" });
    await machine.send({ type: "next" });
    await machine.send({ type: "back" });
    await machine.send({ type: "back" });

    expect(machine.getSnapshot().current).toBe("start");
  });

  it("uses history target for single back", async () => {
    const machine = createFlowMachine(baseFlow());

    await machine.send({ type: "next" });
    await machine.send({ type: "next" });
    await machine.send({ type: "back" });

    expect(machine.getSnapshot().current).toBe("details");
  });

  it("keeps same step when history is empty", async () => {
    const machine = createFlowMachine(baseFlow());

    await machine.send({ type: "back" });

    expect(machine.getSnapshot().current).toBe("start");
  });

  it("handles sparse history entries when resolving history target", async () => {
    const machine = createFlowMachine(baseFlow());

    await machine.send({ type: "next" });
    const history = machine.getSnapshot().history as unknown as Array<StepId | undefined>;
    delete history[0];

    await machine.send({ type: "back" });

    expect(machine.getSnapshot().current).toBe("details");
  });

  it("handles close event with global transitions", async () => {
    const machine = createFlowMachine(baseFlow());

    await machine.send({ type: "close" });

    expect(machine.getSnapshot().status).toBe(FLOW_STATUS.CLOSED);
    expect(machine.getSnapshot().status).not.toBe(FLOW_STATUS.RUNNING);
  });

  it("routes close to confirm step when dirty", async () => {
    const machine = createFlowMachine(baseFlow());

    machine.updateContext((ctx) => ({ ...ctx, dirty: true }));
    await machine.send({ type: "close" });

    expect(machine.getSnapshot().current).toBe("confirmClose");
    expect(machine.getSnapshot().status).toBe(FLOW_STATUS.RUNNING);
  });

  it("supports async guards and effects", async () => {
    const flow = baseFlow();
    flow.transitions = [
      {
        from: "start",
        event: "next",
        to: "details",
        when: async ({ context }) => context.allowNext,
        effect: async ({ context }) => ({ ...context, count: context.count + 1 })
      }
    ];

    const machine = createFlowMachine(flow);

    await machine.send({ type: "next" });

    expect(machine.getSnapshot().current).toBe("details");
    expect(machine.getSnapshot().context.count).toBe(1);
    expect(machine.getSnapshot().async.byStep.start.phase).toBe("idle");
    expect(machine.getSnapshot().async.byStep.start.error).toBeNull();
  });

  it("exposes evaluating-when async phase while guard promise is pending", async () => {
    let release = () => {};
    const wait = new Promise<boolean>((resolve) => {
      release = () => resolve(true);
    });
    const flow = baseFlow();
    flow.transitions = [
      {
        id: "guard-wait",
        from: "start",
        event: "next",
        to: "details",
        when: () => wait
      }
    ];
    const machine = createFlowMachine(flow);
    const pending = machine.send({ type: "next" });

    await Promise.resolve();
    expect(machine.getSnapshot().async.byStep.start.phase).toBe("evaluating-when");
    expect(machine.getSnapshot().async.isLoading).toBe(true);

    release();
    await pending;
    expect(machine.getSnapshot().async.byStep.start.phase).toBe("idle");
    expect(machine.getSnapshot().async.isLoading).toBe(false);
  });

  it("exposes running-effect phase and step error on async effect rejection", async () => {
    let release = () => {};
    const wait = new Promise<Ctx>((resolve, reject) => {
      release = () => reject(new Error("effect-boom"));
      void resolve;
    });
    const flow = baseFlow();
    flow.transitions = [
      {
        id: "effect-wait",
        from: "start",
        event: "next",
        to: "details",
        effect: () => wait
      }
    ];
    const machine = createFlowMachine(flow);
    const pending = machine.send({ type: "next" });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(machine.getSnapshot().async.byStep.start.phase).toBe("running-effect");
    expect(machine.getSnapshot().async.isLoading).toBe(true);

    release();
    await expect(pending).rejects.toThrow("effect-boom");
    expect(machine.getSnapshot().async.byStep.start.phase).toBe("error");
    expect(String(machine.getSnapshot().async.byStep.start.error)).toContain("effect-boom");
    expect(machine.getSnapshot().async.isLoading).toBe(false);
  });

  it("clears step error via clearStepError", async () => {
    const flow = baseFlow();
    flow.transitions = [
      {
        id: "guard-fail",
        from: "start",
        event: "next",
        to: "details",
        when: () => {
          throw new Error("guard-fail");
        }
      }
    ];
    const machine = createFlowMachine(flow);
    await expect(machine.send({ type: "next" })).rejects.toThrow("guard-fail");
    expect(machine.getSnapshot().async.byStep.start.phase).toBe("error");

    machine.clearStepError();
    expect(machine.getSnapshot().async.byStep.start.phase).toBe("idle");
    expect(machine.getSnapshot().async.byStep.start.error).toBeNull();
  });

  it("captures async guard rejection as step error", async () => {
    const flow = baseFlow();
    flow.transitions = [
      {
        id: "guard-async-fail",
        from: "start",
        event: "next",
        to: "details",
        when: async () => {
          await Promise.resolve();
          throw new Error("guard-async-fail");
        }
      }
    ];
    const machine = createFlowMachine(flow);
    await expect(machine.send({ type: "next" })).rejects.toThrow("guard-async-fail");
    expect(machine.getSnapshot().async.byStep.start.phase).toBe("error");
    expect(String(machine.getSnapshot().async.byStep.start.error)).toContain("guard-async-fail");
  });

  it("ignores clearStepError for unknown step ids", () => {
    const machine = createFlowMachine(baseFlow());
    const before = machine.getSnapshot();
    const after = machine.clearStepError("missing" as StepId);
    expect(after).toBe(before);
    expect(machine.getSnapshot()).toBe(before);
  });

  it("rebuilds missing step async state entries when async work starts", async () => {
    let release = () => {};
    const wait = new Promise<Ctx>((resolve) => {
      release = () => resolve(baseFlow().context);
    });
    const flow = baseFlow();
    flow.transitions = [
      {
        id: "rebuild-async",
        from: "start",
        event: "next",
        to: "details",
        effect: () => wait
      }
    ];
    const machine = createFlowMachine(flow);
    const byStep = machine.getSnapshot().async.byStep as unknown as Record<
      StepId,
      | {
          phase: "idle" | "evaluating-when" | "running-effect" | "error";
          eventType: string | null;
          transitionId: string | null;
          error: unknown | null;
        }
      | undefined
    >;
    delete (byStep as Record<string, unknown>).start;

    const pending = machine.send({ type: "next" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(machine.getSnapshot().async.byStep.start.phase).toBe("running-effect");
    release();
    await pending;
  });

  it("serializes concurrent sends", async () => {
    const flow = baseFlow();
    flow.transitions = [
      {
        from: "start",
        event: "next",
        to: "details",
        effect: async ({ context }) => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return { ...context, count: context.count + 1 };
        }
      },
      {
        from: "details",
        event: "next",
        to: "review",
        effect: ({ context }) => ({ ...context, count: context.count + 1 })
      }
    ];

    const machine = createFlowMachine(flow);

    await Promise.all([machine.send({ type: "next" }), machine.send({ type: "next" })]);

    expect(machine.getSnapshot().current).toBe("review");
    expect(machine.getSnapshot().context.count).toBe(2);
    expect(machine.getSnapshot().history).toEqual(["start", "details"]);
  });

  it("goTo jumps to specific step", async () => {
    const machine = createFlowMachine(baseFlow());

    await machine.send({ type: "goTo", to: "review" });

    expect(machine.getSnapshot().current).toBe("review");
    expect(machine.getSnapshot().history).toEqual(["start"]);
  });

  it("throws on unknown goTo target", async () => {
    const machine = createFlowMachine(baseFlow());

    await expect(machine.send({ type: "goTo", to: "unknown" as StepId })).rejects.toThrow(
      "Cannot goTo unknown step"
    );
  });

  it("does nothing if no transition matches", async () => {
    const machine = createFlowMachine(baseFlow());

    const result = await machine.send({ type: "submit" });

    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().current).toBe("start");
  });

  it("moves to terminal complete on submit", async () => {
    const machine = createFlowMachine(baseFlow());

    await machine.send({ type: "goTo", to: "review" });
    await machine.send({ type: "submit" });

    expect(machine.getSnapshot().status).toBe(FLOW_STATUS.COMPLETE);
    expect(machine.getSnapshot().status).not.toBe(FLOW_STATUS.RUNNING);
  });

  it("ignores events after terminal state", async () => {
    const machine = createFlowMachine(baseFlow());

    await machine.send({ type: "close" });
    const result = await machine.send({ type: "next" });

    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().status).toBe(FLOW_STATUS.CLOSED);
  });

  it("supports subscribe and reset", async () => {
    const machine = createFlowMachine(baseFlow());
    let updates = 0;
    const unsubscribe = machine.subscribe(() => {
      updates += 1;
    });

    await machine.send({ type: "next" });
    machine.updateContext((ctx) => ({ ...ctx, count: ctx.count + 1 }));
    machine.reset();
    unsubscribe();

    expect(updates).toBe(3);
    expect(machine.getSnapshot().current).toBe("start");
    expect(machine.getSnapshot().context.count).toBe(0);
  });

  it("validates initial step existence", () => {
    expect(() => {
      createFlowMachine({
        ...baseFlow(),
        initial: "missing" as StepId
      });
    }).toThrow("initial step");
  });
});
