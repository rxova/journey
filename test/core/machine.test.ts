import { describe, expect, it } from "vitest";

import { createFlowMachine, HISTORY_TARGET, FLOW_TERMINAL, type FlowFlow } from "@/src/core";

type StepId = "start" | "details" | "extra" | "review" | "confirmClose";
type Ctx = {
  addExtra: boolean;
  dirty: boolean;
  allowNext: boolean;
  count: number;
};
type Event = "next" | "back" | "close" | "submit";

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
      terminal: null,
      isDone: false
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

    expect(machine.getSnapshot().terminal).toBe(FLOW_TERMINAL.CLOSE);
    expect(machine.getSnapshot().isDone).toBe(true);
  });

  it("routes close to confirm step when dirty", async () => {
    const machine = createFlowMachine(baseFlow());

    machine.updateContext((ctx) => ({ ...ctx, dirty: true }));
    await machine.send({ type: "close" });

    expect(machine.getSnapshot().current).toBe("confirmClose");
    expect(machine.getSnapshot().terminal).toBeNull();
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

    expect(machine.getSnapshot().terminal).toBe(FLOW_TERMINAL.COMPLETE);
    expect(machine.getSnapshot().isDone).toBe(true);
  });

  it("ignores events after terminal state", async () => {
    const machine = createFlowMachine(baseFlow());

    await machine.send({ type: "close" });
    const result = await machine.send({ type: "next" });

    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().terminal).toBe(FLOW_TERMINAL.CLOSE);
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
