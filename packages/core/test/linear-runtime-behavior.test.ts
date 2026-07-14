import { afterEach, describe, expect, it, vi } from "vitest";
import { createLinearJourney, JourneyDisposedError } from "@rxova/journey-core";
import type { LinearJourneyDefinition } from "@rxova/journey-core";

type Ctx = { count: number; note: string };
type StepId = "a" | "b" | "c";

const baseDefinition: LinearJourneyDefinition<Ctx, StepId> = {
  context: { count: 0, note: "" },
  steps: ["a", "b", "c"]
};

const flushMicrotasks = async (cycles = 4) => {
  for (let index = 0; index < cycles; index += 1) {
    await Promise.resolve();
  }
};

afterEach(() => {
  vi.useRealTimers();
});

describe("linear runtime effects", () => {
  it("routes a resolved effect through onResolved with the output", async () => {
    const machine = createLinearJourney<Ctx, StepId>({
      context: { count: 0, note: "" },
      steps: [
        {
          id: "a",
          effect: {
            run: async () => "payload",
            onResolved: {
              to: "c",
              updateContext: ({ context, output }) => ({
                ...context,
                note: String(output)
              })
            }
          }
        },
        "b",
        "c"
      ]
    });

    await machine.controls.start();
    await flushMicrotasks();
    await machine.updateContext((context) => context); // drain the queue

    expect(machine.getSnapshot().currentStepId).toBe("c");
    expect(machine.getSnapshot().context.note).toBe("payload");
  });

  it("routes a rejected effect through onRejected, or records the async error without a branch", async () => {
    const withBranch = createLinearJourney<Ctx, StepId>({
      context: { count: 0, note: "" },
      steps: [
        {
          id: "a",
          effect: {
            run: async () => {
              throw new Error("boom");
            },
            onRejected: {
              to: "b",
              updateContext: ({ context, error }) => ({
                ...context,
                note: error instanceof Error ? error.message : "?"
              })
            }
          }
        },
        "b",
        "c"
      ]
    });
    await withBranch.controls.start();
    await flushMicrotasks();
    await withBranch.updateContext((context) => context);
    expect(withBranch.getSnapshot().currentStepId).toBe("b");
    expect(withBranch.getSnapshot().context.note).toBe("boom");

    const withoutBranch = createLinearJourney<Ctx, StepId>({
      context: { count: 0, note: "" },
      steps: [
        {
          id: "a",
          effect: {
            run: async () => {
              throw new Error("unhandled");
            }
          }
        },
        "b",
        "c"
      ]
    });
    await withoutBranch.controls.start();
    await flushMicrotasks();
    expect(withoutBranch.getSnapshot().currentStepId).toBe("a");
    expect(withoutBranch.getSnapshot().async.byStep.a.phase).toBe("error");
    expect(withoutBranch.getSnapshot().async.byStep.a.error).toBeInstanceOf(Error);
  });

  it("marks the step idle when an effect resolves without a branch, and reports isLoading meanwhile", async () => {
    let release: (() => void) | undefined;
    const machine = createLinearJourney<Ctx, StepId>({
      context: { count: 0, note: "" },
      steps: [
        {
          id: "a",
          effect: {
            run: () =>
              new Promise<void>((resolve) => {
                release = resolve;
              })
          }
        },
        "b",
        "c"
      ]
    });

    await machine.controls.start();
    await flushMicrotasks();
    expect(machine.getSnapshot().async.isLoading).toBe(true);
    expect(machine.getSnapshot().async.byStep.a.phase).toBe("invoking");

    release?.();
    await flushMicrotasks();
    expect(machine.getSnapshot().async.isLoading).toBe(false);
    expect(machine.getSnapshot().async.byStep.a.phase).toBe("idle");
  });

  it("a slow effect's result is discarded after navigating away", async () => {
    let release: (() => void) | undefined;
    const machine = createLinearJourney<Ctx, StepId>({
      context: { count: 0, note: "" },
      steps: [
        {
          id: "a",
          effect: {
            run: () =>
              new Promise<void>((resolve) => {
                release = resolve;
              }),
            onResolved: { to: "c" }
          }
        },
        "b",
        "c"
      ]
    });

    await machine.controls.start();
    await flushMicrotasks();
    await machine.goToNextStep(); // leaves "a"; the pending effect is aborted
    release?.();
    await flushMicrotasks();
    expect(machine.getSnapshot().currentStepId).toBe("b");
  });
});

describe("linear runtime after timers", () => {
  it("fires an after transition with updateContext, and cancels it when leaving early", async () => {
    vi.useFakeTimers();
    const machine = createLinearJourney<Ctx, StepId>({
      context: { count: 0, note: "" },
      steps: [
        {
          id: "a",
          after: {
            50: {
              to: "c",
              updateContext: ({ context }) => ({ ...context, note: "timed" })
            }
          }
        },
        "b",
        "c"
      ]
    });

    await machine.controls.start();
    await vi.advanceTimersByTimeAsync(60);
    expect(machine.getSnapshot().currentStepId).toBe("c");
    expect(machine.getSnapshot().context.note).toBe("timed");

    // Second machine: navigate away before the timer fires.
    const second = createLinearJourney<Ctx, StepId>({
      context: { count: 0, note: "" },
      steps: [{ id: "a", after: { 50: { to: "c" } } }, "b", "c"]
    });
    await second.controls.start();
    await second.goToNextStep();
    await vi.advanceTimersByTimeAsync(100);
    expect(second.getSnapshot().currentStepId).toBe("b");
  });
});

describe("linear runtime lifecycle callbacks", () => {
  it("runs step onLeave/onEnter with dispatch and reports thrown callbacks", async () => {
    const events: string[] = [];
    const onLifecycleError = vi.fn();
    const machine = createLinearJourney<Ctx, StepId>(
      {
        context: { count: 0, note: "" },
        steps: [
          { id: "a", onLeave: () => void events.push("leave-a") },
          {
            id: "b",
            onEnter: () => {
              events.push("enter-b");
              throw new Error("enter failed");
            }
          },
          "c"
        ]
      },
      { onLifecycleError }
    );

    const observed: string[] = [];
    machine.subscribeEvent((event) => {
      if (event.type === "lifecycle.error") {
        observed.push(event.phase);
      }
    });

    await machine.controls.start();
    await machine.goToNextStep();
    await flushMicrotasks();

    expect(events).toEqual(["leave-a", "enter-b"]);
    expect(observed).toEqual(["step.onEnter"]);
    expect(onLifecycleError).toHaveBeenCalledTimes(1);
  });

  it("onEnter can dispatch (terminal auto-advance pattern)", async () => {
    const machine = createLinearJourney<Ctx, "a" | "b">({
      context: { count: 0, note: "" },
      steps: [
        "a",
        {
          id: "b",
          onEnter: ({ dispatch }) => {
            void dispatch({ type: "completeJourney" });
          }
        }
      ]
    });

    await machine.controls.start();
    await machine.goToNextStep();
    await flushMicrotasks();
    await machine.updateContext((context) => context);
    expect(machine.getSnapshot().status).toBe("completed");
  });
});

describe("linear runtime send routing & guards", () => {
  it("routes built-in events through send and drops unknown events via onNoMatch", async () => {
    const onNoMatch = vi.fn();
    const machine = createLinearJourney<Ctx, StepId>(baseDefinition, { onNoMatch });
    await machine.controls.start();

    await machine.send({ type: "goToNextStep" });
    expect(machine.getSnapshot().currentStepId).toBe("b");

    await machine.send({ type: "goToStepById", stepId: "c" });
    expect(machine.getSnapshot().currentStepId).toBe("c");

    await machine.send({ type: "goToPreviousStep" });
    expect(machine.getSnapshot().currentStepId).toBe("b");

    await machine.send({ type: "mystery" } as never);
    expect(onNoMatch).toHaveBeenCalledWith({ from: "b", eventType: "mystery" });

    await machine.send({ type: "terminateJourney" });
    expect(machine.getSnapshot().status).toBe("terminated");
  });

  it("jumping to the current step is a no-match no-op", async () => {
    const onNoMatch = vi.fn();
    const machine = createLinearJourney<Ctx, StepId>(baseDefinition, { onNoMatch });
    await machine.controls.start();

    const result = await machine.goToStepById("a");
    expect(result.transitioned).toBe(false);
    expect(onNoMatch).toHaveBeenCalledWith({ from: "a", eventType: "goToStepById" });
  });

  it("navigation is a no-op before start and after terminal states", async () => {
    const machine = createLinearJourney<Ctx, StepId>(baseDefinition);
    expect((await machine.goToNextStep()).transitioned).toBe(false);
    expect((await machine.goToPreviousStep()).transitioned).toBe(false);
    expect((await machine.goToLastVisitedStep()).transitioned).toBe(false);
    expect((await machine.goToStepById("b")).transitioned).toBe(false);

    await machine.controls.start();
    await machine.controls.complete();
    expect((await machine.goToNextStep()).transitioned).toBe(false);
    expect((await machine.controls.complete()).transitioned).toBe(false);
  });

  it("goToLastVisitedStep returns to the front of the timeline; out-of-range byIndex no-ops", async () => {
    const machine = createLinearJourney<Ctx, StepId>(baseDefinition);
    await machine.controls.start();
    await machine.goToNextStep();
    await machine.goToNextStep();
    await machine.goToPreviousStep(2);
    expect(machine.getSnapshot().currentStepId).toBe("a");
    expect((await machine.goToLastVisitedStep()).snapshot.currentStepId).toBe("c");
    expect((await machine.goToLastVisitedStep()).transitioned).toBe(false);
    expect((await machine.goToStepByIndex(99)).transitioned).toBe(false);
  });

  it("backward goToStepByIndex jumps when the target was never visited", async () => {
    const machine = createLinearJourney<Ctx, StepId>({ ...baseDefinition, initial: "c" });
    await machine.controls.start();

    const result = await machine.goToStepByIndex(1); // "b" — never visited
    expect(result.transitioned).toBe(true);
    expect(result.snapshot.currentStepId).toBe("b");
    expect(result.snapshot.history.timeline).toEqual(["c", "b"]);
  });

  it("honors requireExplicitCompletion on the last step", async () => {
    const onNoMatch = vi.fn();
    const machine = createLinearJourney<Ctx, StepId>(baseDefinition, {
      requireExplicitCompletion: true,
      onNoMatch
    });
    await machine.controls.start();
    await machine.goToStepById("c");

    const result = await machine.goToNextStep();
    expect(result.transitioned).toBe(false);
    expect(onNoMatch).toHaveBeenCalledWith({ from: "c", eventType: "goToNextStep" });

    await machine.controls.complete();
    expect(machine.getSnapshot().status).toBe("completed");
  });

  it("terminal transitions truncate the forward history tail", async () => {
    const machine = createLinearJourney<Ctx, StepId>(baseDefinition);
    await machine.controls.start();
    await machine.goToNextStep();
    await machine.goToNextStep();
    await machine.goToPreviousStep(2); // back at "a" with a forward tail
    await machine.controls.complete();

    expect(machine.getSnapshot().history.timeline).toEqual(["a"]);
    expect(machine.getSnapshot().status).toBe("completed");
  });
});

describe("linear runtime pause", () => {
  it("holds every navigation surface while paused and resumes cleanly", async () => {
    const machine = createLinearJourney<Ctx, StepId>(baseDefinition);
    await machine.controls.start();
    machine.controls.pause();
    machine.controls.pause(); // idempotent

    expect((await machine.goToNextStep()).noOpReason).toBe("paused");
    expect((await machine.goToPreviousStep()).noOpReason).toBe("paused");
    expect((await machine.goToLastVisitedStep()).noOpReason).toBe("paused");
    expect((await machine.goToStepById("b")).noOpReason).toBe("paused");
    expect((await machine.goToStepByIndex(1)).noOpReason).toBe("paused");
    expect((await machine.controls.complete()).noOpReason).toBe("paused");
    expect((await machine.controls.terminate()).noOpReason).toBe("paused");
    expect((await machine.send({ type: "goToNextStep" })).noOpReason).toBe("paused");

    const updated = await machine.updateContext((context) => ({ ...context, count: 5 }));
    expect(updated.context.count).toBe(5);

    machine.controls.resume();
    machine.controls.resume(); // idempotent
    expect((await machine.goToNextStep()).transitioned).toBe(true);
  });
});

describe("linear runtime disposed contract", () => {
  it("navigation after dispose resolves with JourneyDisposedError, matching the graph engine", async () => {
    const machine = createLinearJourney<Ctx, StepId>(baseDefinition);
    await machine.controls.start();
    machine.dispose();

    const next = await machine.goToNextStep();
    const previous = await machine.goToPreviousStep();
    const lastVisited = await machine.goToLastVisitedStep();
    const byId = await machine.goToStepById("b");

    expect(next.transitioned).toBe(false);
    expect(next.error).toBeInstanceOf(JourneyDisposedError);
    expect(previous.error).toBeInstanceOf(JourneyDisposedError);
    expect(lastVisited.error).toBeInstanceOf(JourneyDisposedError);
    expect(byId.error).toBeInstanceOf(JourneyDisposedError);
  });
});

describe("linear runtime controls & subscriptions", () => {
  it("reset returns to the definition initial and emits journey.reset", async () => {
    const machine = createLinearJourney<Ctx, StepId>(baseDefinition);
    const seen: string[] = [];
    const lifecycleLabels: Partial<Record<string, string>> = {
      "journey.start": "start",
      "journey.reset": "reset",
      "journey.completed": "complete",
      "journey.terminated": "terminate"
    };
    machine.subscribeEvent((event) => {
      const label = lifecycleLabels[event.type];
      if (label) {
        seen.push(label);
      }
    });

    await machine.controls.start();
    await machine.goToNextStep();
    await machine.controls.reset();
    expect(machine.getSnapshot().currentStepId).toBe("a");
    expect(machine.getSnapshot().status).toBe("idled");

    await machine.controls.start();
    await machine.controls.complete();
    await machine.controls.reset();
    await machine.controls.start();
    await machine.controls.terminate();

    expect(seen).toEqual(["start", "reset", "start", "complete", "reset", "start", "terminate"]);
  });

  it("clearStepError clears explicit and current-step errors; unknown ids are ignored", async () => {
    const machine = createLinearJourney<Ctx, StepId>(baseDefinition);
    await machine.controls.start();
    machine.registerNextStepInterceptor("a", () => {
      throw new Error("nope");
    });
    await machine.goToNextStep();
    expect(machine.getSnapshot().async.byStep.a.phase).toBe("error");

    await machine.clearStepError("zzz" as StepId);
    expect(machine.getSnapshot().async.byStep.a.phase).toBe("error");

    await machine.clearStepError();
    expect(machine.getSnapshot().async.byStep.a.phase).toBe("idle");
  });

  it("all controls warn and no-op after dispose", async () => {
    const machine = createLinearJourney<Ctx, StepId>(baseDefinition);
    await machine.controls.start();
    machine.dispose();

    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await machine.controls.start();
    await machine.controls.reset();
    await machine.updateContext((context) => context);
    await machine.clearStepError();
    machine.controls.pause();
    machine.controls.resume();
    expect(machine.controls.isPaused()).toBe(false);
    warn.mockRestore();
  });

  it("getStepMeta returns cloned per-step metadata; interceptors reject unknown steps", async () => {
    const machine = createLinearJourney<Ctx, StepId, { label: string }>({
      context: { count: 0, note: "" },
      steps: [{ id: "a", meta: { label: "A" } }, "b", "c"]
    });
    expect(machine.getStepMeta("a")).toEqual({ label: "A" });
    expect(machine.getStepMeta("b")).toBeUndefined();

    expect(() =>
      machine.registerNextStepInterceptor("zzz" as StepId, () => undefined)
    ).toThrowError(/Cannot intercept unknown step/);
  });

  it("interceptors registered for inactive steps do not run", async () => {
    const machine = createLinearJourney<Ctx, StepId>(baseDefinition);
    await machine.controls.start();
    const ran: string[] = [];
    machine.registerNextStepInterceptor("b", () => void ran.push("b"));

    await machine.goToNextStep(); // from "a": no interceptor
    expect(ran).toEqual([]);
    await machine.goToNextStep(); // from "b": intercepted
    expect(ran).toEqual(["b"]);
  });
});

describe("linear runtime edge coverage", () => {
  it("rejects invalid definitions", () => {
    expect(() => createLinearJourney({ context: {}, steps: [] as never })).toThrowError(
      /non-empty array/
    );
    expect(() =>
      createLinearJourney({ context: {}, steps: ["a", "global"] as never })
    ).toThrowError(/reserved/);
    expect(() => createLinearJourney({ context: {}, steps: ["a", "a"] as never })).toThrowError(
      /duplicate step id/
    );
    const machine = createLinearJourney<Ctx, StepId>(baseDefinition);
    expect(() => machine.goToStepById("zzz" as StepId)).toThrowError(/unknown step/);
  });

  it("effect timeouts reject through the timeout error", async () => {
    vi.useFakeTimers();
    const machine = createLinearJourney<Ctx, StepId>({
      context: { count: 0, note: "" },
      steps: [
        {
          id: "a",
          effect: {
            run: () => new Promise<void>(() => undefined),
            timeoutMs: 20
          }
        },
        "b",
        "c"
      ]
    });
    await machine.controls.start();
    await vi.advanceTimersByTimeAsync(30);
    expect(machine.getSnapshot().async.byStep.a.phase).toBe("error");
    expect(String(machine.getSnapshot().async.byStep.a.error)).toContain("timed out");
  });

  it("synchronous effect results resolve without awaiting", async () => {
    const machine = createLinearJourney<Ctx, StepId>({
      context: { count: 0, note: "" },
      steps: [
        {
          id: "a",
          effect: {
            run: () => "sync",
            onResolved: {
              to: "b",
              updateContext: ({ context, output }) => ({ ...context, note: String(output) })
            }
          }
        },
        "b",
        "c"
      ]
    });
    await machine.controls.start();
    await flushMicrotasks();
    await machine.updateContext((context) => context);
    expect(machine.getSnapshot().currentStepId).toBe("b");
    expect(machine.getSnapshot().context.note).toBe("sync");
  });

  it("reports a thrown onLeave and halts that lifecycle", async () => {
    const onLifecycleError = vi.fn();
    const entered: string[] = [];
    const machine = createLinearJourney<Ctx, StepId>(
      {
        context: { count: 0, note: "" },
        steps: [
          {
            id: "a",
            onLeave: () => {
              throw new Error("leave failed");
            }
          },
          { id: "b", onEnter: () => void entered.push("b") },
          "c"
        ]
      },
      { onLifecycleError }
    );
    await machine.controls.start();
    await machine.goToNextStep();
    await flushMicrotasks();
    expect(onLifecycleError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ phase: "step.onLeave" })
    );
    // The navigation itself committed; only the lifecycle chain halted.
    expect(machine.getSnapshot().currentStepId).toBe("b");
    expect(entered).toEqual([]);
  });

  it("exposes devtools force-step control for the linear machine", async () => {
    const { getJourneyMachineDevtoolsRegistry } = await import("@rxova/journey-core");
    const machine = createLinearJourney<Ctx, StepId>(baseDefinition);
    await machine.controls.start();

    const entry = getJourneyMachineDevtoolsRegistry(machine as never);
    expect(entry).toBeDefined();
    const forceStep = entry?.controls?.forceStepTransition;
    expect(forceStep).toBeTypeOf("function");
    const forced = await forceStep!("c");
    expect(forced.transitioned).toBe(true);
    expect(machine.getSnapshot().currentStepId).toBe("c");

    const noop = await forceStep!("c");
    expect(noop.transitioned).toBe(false);
  });

  it("send(goToStepById) and send(completeJourney) route through the linear runtime", async () => {
    const machine = createLinearJourney<Ctx, StepId>(baseDefinition);
    await machine.controls.start();
    await machine.send({ type: "goToStepById", stepId: "b" });
    expect(machine.getSnapshot().currentStepId).toBe("b");
    await machine.send({ type: "completeJourney" });
    expect(machine.getSnapshot().status).toBe("completed");
  });
});

describe("linear runtime remaining branches", () => {
  it("merges definition handlers with creation-time overrides", async () => {
    const seen: string[] = [];
    const machine = createLinearJourney<Ctx, StepId, unknown, { log: (v: string) => void }>(
      {
        context: { count: 0, note: "" },
        handlers: { log: (v) => void seen.push(`def:${v}`) },
        steps: [
          {
            id: "a",
            effect: {
              run: ({ handlers }) => {
                handlers.log("ran");
              }
            }
          },
          "b",
          "c"
        ]
      },
      {
        handlers: { log: (v) => void seen.push(`override:${v}`) },
        onListenerError: () => undefined
      }
    );
    await machine.controls.start();
    await flushMicrotasks();
    expect(seen).toEqual(["override:ran"]);
  });

  it("drops unmatched events through the default no-match reporter", async () => {
    const machine = createLinearJourney<Ctx, StepId>(baseDefinition);
    await machine.controls.start();
    const result = await machine.send({ type: "mystery" } as never);
    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().currentStepId).toBe("a");
  });

  it("custom events are silently false while not running", async () => {
    const machine = createLinearJourney<Ctx, StepId>(baseDefinition);
    const result = await machine.send({ type: "mystery" } as never);
    expect(result.transitioned).toBe(false);
  });

  it("effect branches without updateContext keep the context untouched", async () => {
    const machine = createLinearJourney<Ctx, StepId>({
      context: { count: 7, note: "keep" },
      steps: [
        { id: "a", effect: { run: async () => "x", onResolved: { to: "b" } } },
        {
          id: "b",
          effect: {
            run: async () => {
              throw new Error("next");
            },
            onRejected: { to: "c" }
          }
        },
        "c"
      ]
    });
    await machine.controls.start();
    await flushMicrotasks();
    await machine.updateContext((context) => context);
    await flushMicrotasks();
    await machine.updateContext((context) => context);
    expect(machine.getSnapshot().currentStepId).toBe("c");
    expect(machine.getSnapshot().context).toEqual({ count: 7, note: "keep" });
  });

  it("history navigation landing on the current step id emits no step events", async () => {
    const machine = createLinearJourney<Ctx, StepId>(baseDefinition);
    await machine.controls.start();
    await machine.goToNextStep(); // a → b
    await machine.goToStepById("a"); // jump back: timeline a,b,a

    const stepEvents: string[] = [];
    machine.subscribeEvent((event) => {
      if (event.type === "step.enter" || event.type === "step.exit") {
        stepEvents.push(event.type);
      }
    });

    // Walk back two entries: lands on "a" — the step we're already on.
    const result = await machine.goToPreviousStep(2);
    expect(result.transitioned).toBe(true);
    expect(result.snapshot.currentStepId).toBe("a");
    expect(result.snapshot.history.index).toBe(0);
    expect(stepEvents).toEqual([]);
  });

  it("uses the machine defaultTimeoutMs when the effect has none", async () => {
    vi.useFakeTimers();
    const machine = createLinearJourney<Ctx, StepId>(
      {
        context: { count: 0, note: "" },
        steps: [{ id: "a", effect: { run: () => new Promise<void>(() => undefined) } }, "b", "c"]
      },
      { defaultTimeoutMs: 25 }
    );
    await machine.controls.start();
    await vi.advanceTimersByTimeAsync(40);
    expect(machine.getSnapshot().async.byStep.a.phase).toBe("error");
  });

  it("cancels the pending next-commit when an interceptor navigates elsewhere", async () => {
    const machine = createLinearJourney<Ctx, StepId>(baseDefinition);
    await machine.controls.start();
    machine.registerNextStepInterceptor("a", async () => {
      await machine.goToStepById("c");
    });

    const result = await machine.goToNextStep();
    expect(result.transitioned).toBe(false);
    expect(machine.getSnapshot().currentStepId).toBe("c");
  });

  it("backward goToStepByIndex walks past non-matching history entries", async () => {
    const machine = createLinearJourney<Ctx, StepId>(baseDefinition);
    await machine.controls.start();
    await machine.goToNextStep();
    await machine.goToNextStep(); // timeline a,b,c at c

    const result = await machine.goToStepByIndex(0); // walk past b to a
    expect(result.snapshot.currentStepId).toBe("a");
    expect(result.snapshot.history.timeline).toEqual(["a", "b", "c"]);
  });
});
