import { describe, expect, expectTypeOf, it } from "vitest";
import {
  analyzeStructure,
  createGraphJourney,
  defineAlways,
  isJourneyError,
  withGraphTypes
} from "@rxova/journey-core";
import { flush, wait } from "@rxova/journey-core/testing";
import type { JourneyStorage } from "@rxova/journey-core/plugins";

type Ctx = { n: number; ok: boolean };

describe("always", () => {
  it("moves on its own once the step's entry effects settle", async () => {
    const order: string[] = [];
    const machine = createGraphJourney({
      initial: "redirect",
      context: { n: 0 },
      steps: {
        redirect: {
          onEnter: async () => {
            await wait(1);
            order.push("enter redirect");
          },
          always: "home"
        },
        home: { onEnter: () => void order.push("enter home") }
      }
    });
    await wait(10);

    expect(machine.getSnapshot().currentStep?.id).toBe("home");
    expect(machine.getSnapshot().history.timeline).toEqual(["redirect", "home"]);
    expect(order).toEqual(["enter redirect", "enter home"]);
  });

  it("takes the first enabled candidate, and stays when none is enabled", async () => {
    const pick = (n: number) =>
      createGraphJourney(
        {
          initial: "decide",
          context: { n },
          steps: {
            decide: {
              always: [
                { to: "big", when: ({ context }) => context.n > 10 },
                { to: "small", when: ({ context }) => context.n > 0 }
              ],
              on: { SKIP: "small" }
            },
            big: {},
            small: {}
          }
        },
        { autoStart: false }
      );

    const big = pick(20);
    const small = pick(5);
    const none = pick(0);
    const blocked: unknown[] = [];
    none.subscriptions.subscribeEvent("navigationBlocked", (e) =>
      blocked.push([e.reason, e.from, e.to])
    );
    for (const machine of [big, small, none]) machine.controls.start();
    await flush();

    expect(big.getSnapshot().currentStep?.id).toBe("big");
    expect(small.getSnapshot().currentStep?.id).toBe("small");
    const resting = none.getSnapshot();
    expect(resting.currentStep?.id).toBe("decide");
    expect(resting.transition.pending).toBe(false);
    expect(blocked).toEqual([["no-enabled-transition", "decide", null]]);
    // `always` is no event: a caller cannot send it, so it is not listed.
    expect(resting.declaredEvents).toEqual(["SKIP"]);
    expect(resting.availableEvents).toEqual(["SKIP"]);
    expect(resting.currentStep?.isTerminal).toBe(false);
    expect(resting.outgoingTransitions.map((t) => [t.event, t.to, t.enabled])).toEqual([
      ["SKIP", "small", true],
      ["$always", "big", false],
      ["$always", "small", false]
    ]);
  });

  it("resolves the call that entered the step only once the chain rests", async () => {
    const machine = createGraphJourney({
      initial: "idle",
      context: {},
      steps: {
        idle: { on: { GO: "a" } },
        a: { always: "b" },
        b: { onEnter: () => wait(5), always: "c" },
        c: {}
      }
    });
    await flush();

    const result = await machine.send("GO");

    expect(result).toEqual({ ok: true, from: "idle", to: "a" });
    expect(machine.getSnapshot().currentStep?.id).toBe("c");
    expect(machine.getSnapshot().history.timeline).toEqual(["idle", "a", "b", "c"]);
  });

  it("hands hooks a null event and the always edge", async () => {
    const seen: unknown[] = [];
    createGraphJourney({
      initial: "a",
      context: {},
      steps: {
        a: {
          always: [{ to: "b", label: "skip-a", onTransition: ({ event }) => void seen.push(event) }]
        },
        b: {
          onEnter: ({ event, transition, from }) => void seen.push(event, transition, from)
        }
      }
    });
    await flush();

    expect(seen).toEqual([
      null,
      null,
      { event: "$always", from: "a", to: "b", label: "skip-a", index: 0 },
      "a"
    ]);
  });

  describe("with work", () => {
    const machineWith = (
      run: (args: { event: unknown; signal: AbortSignal }) => unknown,
      options: { defaultTimeoutMs?: number } = {}
    ) =>
      createGraphJourney(
        {
          initial: "check",
          context: { n: 0, ok: false } as Ctx,
          steps: {
            check: {
              always: {
                run,
                commit: ({ result, updateContext }) =>
                  updateContext((c) => ({ ...c, ok: result === "yes", n: c.n + 1 })),
                label: "session-check",
                candidates: [{ to: "home", when: ({ context }) => context.ok }]
              },
              on: { RETRY: "check" }
            },
            home: {}
          }
        },
        options
      );

    it("runs the work, stages its context and routes on it", async () => {
      const args: { event: unknown; signal: AbortSignal }[] = [];
      const machine = machineWith((a) => {
        args.push(a);
        return "yes";
      });
      await flush();

      expect(machine.getSnapshot().currentStep?.id).toBe("home");
      expect(machine.getSnapshot().context).toEqual({ n: 1, ok: true });
      expect(args[0]?.event).toBeNull();
      expect(args[0]?.signal.aborted).toBe(false);
    });

    it("rolls the staged context back when no candidate is enabled", async () => {
      const blocked: unknown[] = [];
      const machine = machineWith(() => "no");
      machine.subscriptions.subscribeEvent("navigationBlocked", ({ reason, from, to }) =>
        blocked.push([reason, from, to])
      );
      await flush();

      expect(machine.getSnapshot().currentStep?.id).toBe("check");
      expect(machine.getSnapshot().context).toEqual({ n: 0, ok: false });
      expect(machine.getSnapshot().currentStep?.async.isSuccess).toBe(true);
      expect(blocked).toEqual([["no-enabled-transition", "check", null]]);
    });

    it("surfaces a failing run as a work error and stays on the step", async () => {
      const errors: unknown[] = [];
      const machine = machineWith(() => {
        throw new Error("down");
      });
      machine.subscriptions.subscribeEvent("error", (e) => errors.push([e.phase, e.stepId]));
      await flush();
      await machine.send("RETRY");

      expect(machine.getSnapshot().currentStep?.id).toBe("check");
      expect(machine.getSnapshot().currentStep?.async.isError).toBe(true);
      // RETRY re-enters the step, which runs its always work again.
      expect(errors).toEqual([
        ["work", "check"],
        ["work", "check"]
      ]);
    });

    it("times out under its label, aborting the signal", async () => {
      let signal: AbortSignal | undefined;
      const machine = machineWith(
        (a) => {
          signal = a.signal;
          return wait(50);
        },
        { defaultTimeoutMs: 5 }
      );
      await wait(20);

      expect(signal?.aborted).toBe(true);
      expect(String(machine.getSnapshot().currentStep?.async.error)).toMatch(
        /send work\(session-check\) timed out after 5ms/
      );
    });

    it("is cancelled by terminate while it runs", async () => {
      let signal: AbortSignal | undefined;
      const machine = machineWith((a) => {
        signal = a.signal;
        return wait(20).then(() => "yes");
      });
      await flush();
      machine.controls.terminate();
      await wait(30);

      expect(signal?.aborted).toBe(true);
      expect(machine.getSnapshot().status).toBe("terminated");
      expect(machine.getSnapshot().currentStep?.id).toBe("check");
    });
  });

  it("cuts a cycle off after maxAutoSteps and counts afresh after an outside call", async () => {
    const errors: { phase: string; stepId: string | null; message: string }[] = [];
    const machine = createGraphJourney(
      {
        initial: "idle",
        context: {},
        steps: {
          idle: { on: { GO: "ping" } },
          ping: { always: "pong", on: { STOP: "idle" } },
          pong: { always: "ping", on: { STOP: "idle" } }
        }
      },
      { maxAutoSteps: 3 }
    );
    machine.subscriptions.subscribeEvent("error", ({ phase, stepId, error }) =>
      errors.push({ phase, stepId, message: (error as Error).message })
    );
    await flush();

    await machine.send("GO");
    expect(machine.getSnapshot().history.timeline).toEqual([
      "idle",
      "ping",
      "pong",
      "ping",
      "pong"
    ]);
    expect(errors).toEqual([
      {
        phase: "always",
        stepId: "pong",
        message: 'journey: always chain exceeded 3 moves; stopped at "pong"'
      }
    ]);

    await machine.send("STOP");
    await machine.send("GO");
    expect(machine.getSnapshot().history.timeline).toHaveLength(10);
    expect(errors).toHaveLength(2);
  });

  it("defaults maxAutoSteps to 100", async () => {
    const errors: string[] = [];
    const machine = createGraphJourney(
      {
        initial: "ping",
        context: {},
        steps: { ping: { always: "pong" }, pong: { always: "ping" } }
      },
      { autoStart: false }
    );
    machine.subscriptions.subscribeEvent("error", ({ error }) =>
      errors.push((error as Error).message)
    );
    machine.controls.start();
    await wait(20);

    expect(machine.getSnapshot().history.timeline).toHaveLength(101);
    expect(errors).toEqual(['journey: always chain exceeded 100 moves; stopped at "ping"']);
  });

  it("drains events raised on an always step after the chain moves on", async () => {
    const machine = createGraphJourney({
      initial: "a",
      context: {},
      steps: {
        a: { onEnter: ({ raise }) => raise({ type: "NEXT" }), always: "b" },
        b: { on: { NEXT: "c" } },
        c: {}
      }
    });
    await wait(5);

    expect(machine.getSnapshot().history.timeline).toEqual(["a", "b", "c"]);
  });

  it("does not run while the machine is not running", async () => {
    const machine = createGraphJourney({
      initial: "a",
      context: {},
      steps: { a: { on: { GO: "b" } }, b: { always: "c" }, c: {} }
    });
    await flush();
    // The first publish after b's entry effects settle is the earliest point
    // complete() is accepted, and it comes before b's always entry would run.
    machine.subscriptions.subscribe(() => {
      const snapshot = machine.getSnapshot();
      if (snapshot.currentStep?.id === "b" && !snapshot.transition.pending) {
        machine.controls.complete();
      }
    });
    await machine.send("GO");

    expect(machine.getSnapshot().status).toBe("completed");
    expect(machine.getSnapshot().currentStep?.id).toBe("b");
  });

  it("is not a target goToStepById can take", async () => {
    const machine = createGraphJourney({
      initial: "a",
      context: { go: false },
      steps: {
        a: { always: [{ to: "b", when: ({ context }) => context.go }] },
        b: {}
      }
    });
    await flush();
    machine.context.update(() => ({ go: true }));

    expect(await machine.navigate.goToStepById("b")).toMatchObject({
      ok: false,
      reason: "invalid-target"
    });
    expect(machine.getSnapshot().availableSteps).toEqual(["b"]);
  });

  it("re-runs on the step a persisted session restores onto", async () => {
    const data = new Map<string, string>();
    const storage: JourneyStorage = {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => void data.set(key, value),
      removeItem: (key) => void data.delete(key)
    };
    data.set(
      "judge",
      JSON.stringify({
        status: "running",
        context: { ready: true },
        timeline: ["start", "wait"],
        currentIndex: 1,
        savedAt: 1
      })
    );
    const machine = createGraphJourney(
      {
        initial: "start",
        context: { ready: false },
        steps: {
          start: { on: { GO: "wait" } },
          wait: { always: [{ to: "done", when: ({ context }) => context.ready }] },
          done: {}
        }
      },
      { persist: { key: "judge", storage } }
    );
    await flush();

    expect(machine.getSnapshot().history.timeline).toEqual(["start", "wait", "done"]);
  });

  it("reserves $always as an event name", () => {
    let caught: unknown;
    try {
      createGraphJourney({
        initial: "a",
        context: {},
        steps: { a: { on: { $always: "b" } }, b: {} }
      });
    } catch (error) {
      caught = error;
    }

    expect(isJourneyError(caught) && caught.code).toBe("reserved-event");
    expect(isJourneyError(caught) && [caught.stepId, caught.event]).toEqual(["a", "$always"]);
  });

  it("is an edge to analyzeStructure", () => {
    const result = analyzeStructure({
      initial: "a",
      steps: {
        a: { always: [{ to: "b", when: () => true }, { to: "c" }] },
        b: {},
        c: {},
        orphan: {}
      }
    });

    expect(result.summary.reachableStepCount).toBe(3);
    expect(result.summary.terminalPathExists).toBe(true);
    expect(result.issues.map((issue) => [issue.code, issue.stepId ?? issue.event])).toEqual([
      ["unreachable-step", "orphan"]
    ]);
  });
});

describe("defineAlways", () => {
  type Bag = {
    context: { valid: boolean };
    stepId: "check" | "home" | "login";
    events: { type: "RETRY" };
    handlers: { readonly session: () => Promise<{ readonly valid: boolean }> };
  };

  it("infers the run result into commit", async () => {
    const machine = withGraphTypes<Bag>()({
      initial: "check",
      context: { valid: false },
      handlers: { session: () => Promise.resolve({ valid: true }) },
      steps: {
        check: {
          always: defineAlways<Bag>()({
            run: ({ handlers, event }) => {
              expectTypeOf(event).toEqualTypeOf<null>();
              return handlers.session();
            },
            commit: ({ result, updateContext }) => {
              expectTypeOf(result).toEqualTypeOf<{ readonly valid: boolean }>();
              updateContext(() => ({ valid: result.valid }));
            },
            candidates: [{ to: "home", when: ({ context }) => context.valid }, { to: "login" }]
          }),
          on: { RETRY: "check" }
        },
        home: {},
        login: {}
      }
    });
    await flush();

    expect(machine.getSnapshot().currentStep?.id).toBe("home");
  });
});
