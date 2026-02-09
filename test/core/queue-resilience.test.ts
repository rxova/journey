import { describe, expect, it } from "vitest";

import { createFlowMachine, type FlowFlow } from "@/src/core";

type StepId = "start" | "mid" | "end";
type Event = "next";
type Ctx = { count: number; marks: string[] };

const createQueueFlow = (): FlowFlow<Ctx, StepId, Event> => ({
  initial: "start",
  context: { count: 0, marks: [] },
  steps: {
    start: {},
    mid: {},
    end: {}
  },
  transitions: [
    {
      id: "start-mid",
      from: "start",
      event: "next",
      to: "mid",
      effect: async ({ context }) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          ...context,
          count: context.count + 1,
          marks: [...context.marks, "start-mid"]
        };
      }
    },
    {
      id: "mid-end",
      from: "mid",
      event: "next",
      to: "end",
      effect: ({ context }) => ({
        ...context,
        count: context.count + 1,
        marks: [...context.marks, "mid-end"]
      })
    }
  ]
});

describe("queue resilience", () => {
  it("processes concurrent sends in order", async () => {
    const machine = createFlowMachine(createQueueFlow());
    await Promise.all([machine.send({ type: "next" }), machine.send({ type: "next" })]);
    expect(machine.getSnapshot().current).toBe("end");
    expect(machine.getSnapshot().context.count).toBe(2);
    expect(machine.getSnapshot().context.marks).toEqual(["start-mid", "mid-end"]);
  });

  it("keeps queue alive after a rejected send", async () => {
    const failingFlow: FlowFlow<Ctx, StepId, Event> = {
      ...createQueueFlow(),
      transitions: [
        {
          id: "start-mid",
          from: "start",
          event: "next",
          to: "mid",
          effect: () => {
            throw new Error("boom");
          }
        },
        {
          id: "mid-end",
          from: "mid",
          event: "next",
          to: "end",
          effect: ({ context }) => ({ ...context, count: context.count + 1 })
        }
      ]
    };

    const machine = createFlowMachine(failingFlow);

    await expect(machine.send({ type: "next" })).rejects.toThrow("boom");
    expect(machine.getSnapshot().current).toBe("start");

    const jumped = await machine.send({ type: "goTo", to: "mid" });
    expect(jumped.transitioned).toBe(true);
    const recovered = await machine.send({ type: "next" });
    expect(recovered.transitioned).toBe(true);
    expect(machine.getSnapshot().current).toBe("end");
  });

  it("supports many queued sends where only first two can transition", async () => {
    const machine = createFlowMachine(createQueueFlow());
    const results = await Promise.all([
      machine.send({ type: "next" }),
      machine.send({ type: "next" }),
      machine.send({ type: "next" }),
      machine.send({ type: "next" })
    ]);

    expect(results.map((r) => r.transitioned)).toEqual([true, true, false, false]);
    expect(machine.getSnapshot().current).toBe("end");
  });

  it("keeps history consistent under queued sends", async () => {
    const machine = createFlowMachine(createQueueFlow());
    await Promise.all([machine.send({ type: "next" }), machine.send({ type: "next" })]);
    expect(machine.getSnapshot().history).toEqual(["start", "mid"]);
  });

  it("notifies subscribers per successful state change from queue", async () => {
    const machine = createFlowMachine(createQueueFlow());
    let notifications = 0;
    machine.subscribe(() => {
      notifications += 1;
    });

    await Promise.all([machine.send({ type: "next" }), machine.send({ type: "next" })]);

    expect(notifications).toBe(2);
  });

  it("returns same snapshot reference values after no-op queued sends", async () => {
    const machine = createFlowMachine(createQueueFlow());
    await machine.send({ type: "next" });
    await machine.send({ type: "next" });
    const snapBefore = machine.getSnapshot();
    const result = await machine.send({ type: "next" });
    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().current).toBe(snapBefore.current);
    expect(machine.getSnapshot().history).toEqual(snapBefore.history);
  });

  it("allows updateContext while queue is idle", () => {
    const machine = createFlowMachine(createQueueFlow());
    machine.updateContext((ctx) => ({ ...ctx, count: 42 }));
    expect(machine.getSnapshot().context.count).toBe(42);
  });

  it("allows reset after queued transitions", async () => {
    const machine = createFlowMachine(createQueueFlow());
    await Promise.all([machine.send({ type: "next" }), machine.send({ type: "next" })]);
    machine.reset();
    expect(machine.getSnapshot().current).toBe("start");
    expect(machine.getSnapshot().history).toEqual([]);
  });

  it("applies goTo after queued transitions", async () => {
    const machine = createFlowMachine(createQueueFlow());
    await Promise.all([machine.send({ type: "next" })]);
    await machine.send({ type: "goTo", to: "end" });
    expect(machine.getSnapshot().current).toBe("end");
    expect(machine.getSnapshot().history).toEqual(["start", "mid"]);
  });

  it("returns goTo transition id for queued goTo", async () => {
    const machine = createFlowMachine(createQueueFlow());
    const result = await machine.send({ type: "goTo", to: "mid" });
    expect(result.transitionId).toBe("goTo");
  });

  it("rejects queued unknown goTo", async () => {
    const machine = createFlowMachine(createQueueFlow());
    await expect(machine.send({ type: "goTo", to: "missing" as StepId })).rejects.toThrow(
      "Cannot goTo unknown step"
    );
  });

  it("continues processing after rejected unknown goTo", async () => {
    const machine = createFlowMachine(createQueueFlow());
    await expect(machine.send({ type: "goTo", to: "missing" as StepId })).rejects.toThrow();
    const result = await machine.send({ type: "next" });
    expect(result.transitioned).toBe(true);
    expect(machine.getSnapshot().current).toBe("mid");
  });

  it("keeps visited deterministic under queue", async () => {
    const machine = createFlowMachine(createQueueFlow());
    await Promise.all([machine.send({ type: "next" }), machine.send({ type: "next" })]);
    expect(machine.getSnapshot().visited).toEqual(["start", "mid", "end"]);
  });

  it("preserves context object shape across queued effects", async () => {
    const machine = createFlowMachine(createQueueFlow());
    await Promise.all([machine.send({ type: "next" }), machine.send({ type: "next" })]);
    expect(machine.getSnapshot().context).toHaveProperty("count");
    expect(machine.getSnapshot().context).toHaveProperty("marks");
  });

  it("queued sends do not bypass terminal lock", async () => {
    const flow: FlowFlow<Ctx, StepId, "next" | "submit"> = {
      ...createQueueFlow(),
      transitions: [
        {
          from: "start",
          event: "next",
          to: "mid"
        },
        {
          from: "mid",
          event: "submit",
          to: "COMPLETE"
        }
      ]
    };

    const machine = createFlowMachine(flow);
    await machine.send({ type: "next" });
    await machine.send({ type: "submit" });
    const result = await machine.send({ type: "next" });
    expect(result.transitioned).toBe(false);
  });
});
