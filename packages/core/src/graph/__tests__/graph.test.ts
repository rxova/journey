import { describe, expect, it, vi } from "vitest";
import { createGraphJourney, MAX_RAISED_EVENTS } from "@rxova/journey-core";
import { flush, wait } from "@rxova/journey-core/testing";

type Ctx = { valid: boolean; confirmed: boolean; retries: number };

async function startedGraph(context: Partial<Ctx> = {}) {
  const machine = createGraphJourney({
    steps: { form: {}, review: {}, done: {} },
    transitions: {
      SUBMIT: { from: "form", to: "review", when: ({ context: c }) => (c as Ctx).valid },
      EDIT: { from: "review", to: "form" },
      CONFIRM: [
        { from: "review", to: "done", when: ({ context: c }) => (c as Ctx).confirmed },
        { from: "review", to: "form" }
      ]
    },
    initial: "form",
    context: { valid: true, confirmed: false, retries: 0, ...context }
  });
  machine.controls.start();
  await flush();
  return machine;
}

describe("createGraphJourney — event-driven transitions", () => {
  it("send executes the matching enabled transition", async () => {
    const machine = await startedGraph();
    expect(await machine.send("SUBMIT")).toEqual({ ok: true, from: "form", to: "review" });
    expect(machine.getSnapshot().currentStep?.id).toBe("review");
  });

  it("send with no enabled transition fails with no-enabled-transition", async () => {
    const machine = await startedGraph({ valid: false });
    expect(await machine.send("SUBMIT")).toEqual({ ok: false, reason: "no-enabled-transition" });
    expect(await machine.send("UNKNOWN")).toEqual({ ok: false, reason: "no-enabled-transition" });
    expect(await machine.send("EDIT")).toEqual({ ok: false, reason: "no-enabled-transition" });
  });

  it("multiple candidates per event: first enabled in declaration order wins", async () => {
    const fallback = await startedGraph();
    await fallback.send("SUBMIT");
    expect(await fallback.send("CONFIRM")).toEqual({ ok: true, from: "review", to: "form" });

    const confirmed = await startedGraph({ confirmed: true });
    await confirmed.send("SUBMIT");
    expect(await confirmed.send("CONFIRM")).toEqual({ ok: true, from: "review", to: "done" });
  });

  it("runs the pipeline in order: onLeave → commit events → onTransition → onEnter", async () => {
    const log: string[] = [];
    const machine = createGraphJourney({
      steps: {
        a: { onLeave: () => void log.push("onLeave:a") },
        b: { onEnter: () => void log.push("onEnter:b") }
      },
      transitions: {
        GO: { from: "a", to: "b", onTransition: async () => void log.push("onTransition") }
      },
      initial: "a",
      context: {}
    });
    machine.controls.start();
    await flush();
    machine.subscriptions.subscribeEvent("stepLeave", ({ from }) => log.push(`stepLeave:${from}`));
    machine.subscriptions.subscribeEvent("stepEnter", ({ to }) => log.push(`stepEnter:${to}`));

    await machine.send("GO");
    expect(log).toEqual(["onLeave:a", "stepLeave:a", "stepEnter:b", "onTransition", "onEnter:b"]);
  });

  it("delivers the event (type + payload) to onTransition and onEnter", async () => {
    const seen: unknown[] = [];
    const machine = createGraphJourney({
      steps: {
        a: {},
        b: { onEnter: ({ event }) => void seen.push(["enter", event]) }
      },
      transitions: {
        GO: {
          from: "a",
          to: "b",
          onTransition: ({ event }) => void seen.push(["transition", event])
        }
      },
      initial: "a",
      context: {}
    });
    machine.controls.start();
    await flush();

    await machine.send("GO", { code: 42 });
    expect(seen).toEqual([
      ["transition", { type: "GO", payload: { code: 42 } }],
      ["enter", { type: "GO", payload: { code: 42 } }]
    ]);
  });

  it("onTransition throwing is handled like an onEnter throw (onEnter skipped)", async () => {
    const boom = new Error("effect failed");
    const enter = vi.fn();
    const machine = createGraphJourney({
      steps: { a: {}, b: { onEnter: enter } },
      transitions: {
        GO: {
          from: "a",
          to: "b",
          onTransition: () => {
            throw boom;
          }
        }
      },
      initial: "a",
      context: {}
    });
    machine.controls.start();
    await flush();
    const errors: unknown[] = [];
    machine.subscriptions.subscribeEvent("error", (payload) => errors.push(payload));

    expect(await machine.send("GO")).toEqual({ ok: true, from: "a", to: "b" });
    expect(machine.getSnapshot().currentStep?.async.isError).toBe(true);
    expect(errors).toMatchObject([{ error: boom, phase: "transition", stepId: "b" }]);
    expect(enter).not.toHaveBeenCalled();
  });

  it("goToStepById is transition-gated sugar", async () => {
    const machine = await startedGraph();
    expect(await machine.navigate.goToStepById("done")).toEqual({
      ok: false,
      reason: "invalid-target"
    });
    expect(await machine.navigate.goToStepById("review")).toEqual({
      ok: true,
      from: "form",
      to: "review"
    });
  });

  it("goToStepById runs the resolved transition's callbacks", async () => {
    const effect = vi.fn();
    const machine = createGraphJourney({
      steps: { a: {}, b: {} },
      transitions: { GO: { from: "a", to: "b", onTransition: effect } },
      initial: "a",
      context: {}
    });
    machine.controls.start();
    await flush();

    await machine.navigate.goToStepById("b");
    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("timeline moves bypass transition gating but step guards still run", async () => {
    const leaveB = vi.fn();
    const machine = createGraphJourney({
      steps: { a: {}, b: { onLeave: leaveB } },
      transitions: { GO: { from: "a", to: "b" } }, // no way back via transitions
      initial: "a",
      context: {}
    });
    machine.controls.start();
    await flush();
    await machine.send("GO");

    expect(await machine.navigate.goToPreviousStep()).toEqual({ ok: true, from: "b", to: "a" });
    expect(leaveB).toHaveBeenCalledTimes(1);
    expect(await machine.navigate.goToNextStep()).toEqual({ ok: true, from: "a", to: "b" });
    // at the tip, graph has no declared-order fallback
    expect(await machine.navigate.goToNextStep()).toEqual({ ok: false, reason: "out-of-bounds" });
  });

  it("derives availableEvents, availableSteps, and isTerminal from enabled transitions", async () => {
    const machine = await startedGraph({ valid: false });
    let snapshot = machine.getSnapshot();
    expect(snapshot.type).toBe("graph");
    expect(snapshot.availableEvents).toEqual([]);
    expect(snapshot.availableSteps).toEqual([]);
    expect(snapshot.currentStep?.isTerminal).toBe(false);

    machine.context.update((c) => ({ ...(c as Ctx), valid: true }));
    snapshot = machine.getSnapshot();
    expect(snapshot.availableEvents).toEqual(["SUBMIT"]);
    expect(snapshot.availableSteps).toEqual(["review"]);

    await machine.send("SUBMIT");
    snapshot = machine.getSnapshot();
    expect(snapshot.availableEvents).toEqual(["EDIT", "CONFIRM"]);
    expect(snapshot.availableSteps).toEqual(["form"]);

    machine.context.update((c) => ({ ...(c as Ctx), confirmed: true }));
    await machine.send("CONFIRM");
    expect(machine.getSnapshot().currentStep?.isTerminal).toBe(true);
  });

  it("graph snapshots have no linear-only fields", async () => {
    const machine = await startedGraph();
    const snapshot = machine.getSnapshot();
    expect("stepOrder" in snapshot.steps).toBe(false);
    expect("index" in (snapshot.currentStep ?? {})).toBe(false);
    expect("isFirstStep" in (snapshot.currentStep ?? {})).toBe(false);
    expect(snapshot.steps.totalSteps).toBe(3);
  });

  it("supports self-transitions via send (retry loops)", async () => {
    const machine = createGraphJourney({
      steps: { verify: {} },
      transitions: {
        RETRY: {
          from: "verify",
          to: "verify",
          onTransition: ({ updateContext }) =>
            void updateContext((c) => ({ retries: (c as { retries: number }).retries + 1 }))
        }
      },
      initial: "verify",
      context: { retries: 0 }
    });
    machine.controls.start();
    await flush();

    expect(await machine.send("RETRY")).toEqual({ ok: true, from: "verify", to: "verify" });
    expect(machine.getSnapshot().context).toEqual({ retries: 1 });
    expect(machine.getSnapshot().history.timeline).toEqual(["verify", "verify"]);
    expect(machine.getSnapshot().currentStep?.isFirstTimeVisit).toBe(false);
  });

  it("handlers are injected into guards and can be overridden per runtime", async () => {
    const definition = {
      steps: { a: {}, b: {} },
      transitions: {
        GO: {
          from: "a",
          to: "b",
          when: ({ handlers }: { context: unknown; handlers: unknown }) =>
            (handlers as { allowed(): boolean }).allowed()
        }
      },
      initial: "a",
      context: {},
      handlers: { allowed: () => false }
    } as const;

    const app = createGraphJourney(definition);
    app.controls.start();
    await flush();
    expect(await app.send("GO")).toEqual({ ok: false, reason: "no-enabled-transition" });

    const test = createGraphJourney(definition, { handlers: { allowed: () => true } });
    test.controls.start();
    await flush();
    expect(await test.send("GO")).toEqual({ ok: true, from: "a", to: "b" });
  });

  it("raise queues events for after settle; direct send inside hooks is rejected", async () => {
    const directResults: unknown[] = [];
    const machine = createGraphJourney({
      steps: {
        a: {},
        b: {
          onEnter: async ({ raise }) => {
            directResults.push(await machineRef.send("FINISH"));
            raise({ type: "FINISH" });
          }
        },
        c: {}
      },
      transitions: {
        GO: { from: "a", to: "b" },
        FINISH: { from: "b", to: "c" }
      },
      initial: "a",
      context: {}
    });
    const machineRef = machine;
    machine.controls.start();
    await flush();

    expect(await machine.send("GO")).toEqual({ ok: true, from: "a", to: "b" });
    await flush();
    expect(directResults).toEqual([{ ok: false, reason: "transitioning" }]);
    expect(machine.getSnapshot().currentStep?.id).toBe("c");
  });

  it("caps runaway raise cascades and surfaces a raise-phase error", async () => {
    let raiseCount = 0;
    const machine = createGraphJourney({
      steps: {
        loop: {
          onEnter: ({ raise }) => {
            raiseCount += 1;
            raise({ type: "AGAIN" });
          }
        }
      },
      transitions: { AGAIN: { from: "loop", to: "loop" } },
      initial: "loop",
      context: {}
    });
    const errors: unknown[] = [];
    machine.subscriptions.subscribeEvent("error", (payload) => errors.push(payload));
    machine.controls.start();

    await vi.waitFor(() => {
      expect(errors.length).toBeGreaterThan(0);
    });
    expect(errors[0]).toMatchObject({ phase: "raise" });
    expect(String((errors[0] as { error: Error }).error.message)).toContain("cascade");
    expect(raiseCount).toBeLessThanOrEqual(MAX_RAISED_EVENTS + 2);
    await flush();
    expect(machine.getSnapshot().transition.pending).toBe(false);
  });

  it("validates the definition at creation", () => {
    expect(() =>
      createGraphJourney({ steps: {}, transitions: {}, initial: "a" as never, context: {} })
    ).toThrow(/at least one step/);
    expect(() =>
      createGraphJourney({
        steps: { a: {} },
        transitions: {},
        initial: "b" as never,
        context: {}
      })
    ).toThrow(/initial step "b"/);
    expect(() =>
      createGraphJourney({
        steps: { a: {} },
        transitions: { GO: { from: "a", to: "ghost" as never } },
        initial: "a",
        context: {}
      })
    ).toThrow(/unknown step "ghost"/);
  });

  it("rejects navigation while a guard chain is pending", async () => {
    const machine = createGraphJourney({
      steps: { a: { onLeave: () => wait(30) }, b: {} },
      transitions: { GO: { from: "a", to: "b" } },
      initial: "a",
      context: {}
    });
    machine.controls.start();
    await flush();

    const first = machine.send("GO");
    expect(await machine.send("GO")).toEqual({ ok: false, reason: "transitioning" });
    expect(await first).toEqual({ ok: true, from: "a", to: "b" });
  });
});
