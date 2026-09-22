import { describe, expect, it } from "vitest";
import {
  createGraphJourney,
  isJourneyError,
  type JourneyRuntimeOptions
} from "@rxova/journey-core";
import { flush, startedLinear, wait } from "@rxova/journey-core/testing";

const boom = new Error("boom");

/** A graph whose every pipeline stage can be made to throw on demand. */
function failing(
  stage: "work" | "leave" | "enter" | "transition" | "none",
  options: Pick<JourneyRuntimeOptions, "onError"> = {}
) {
  const fail = (at: typeof stage) => () => {
    if (stage === at) throw boom;
  };
  const machine = createGraphJourney(
    {
      initial: "a",
      context: {},
      steps: {
        a: {
          onLeave: fail("leave"),
          on: {
            GO: [{ to: "b", onTransition: fail("transition") }],
            WORK: { run: fail("work"), candidates: [{ to: "b" }] }
          }
        },
        b: { onEnter: fail("enter"), on: { BACK: "a" } }
      }
    },
    { autoStart: false, ...options }
  );
  const events: unknown[] = [];
  machine.subscriptions.subscribeEvent("error", (e) => events.push(["error", e.phase]));
  machine.subscriptions.subscribeEvent("navigationBlocked", (e) =>
    events.push(["blocked", e.reason])
  );
  machine.subscriptions.subscribeEvent("statusChange", (e) => events.push(["status", e.current]));
  machine.controls.start();
  return { machine, events };
}

describe("settled()", () => {
  it("resolves with the outcome on complete, and at once once settled", async () => {
    const machine = await startedLinear();
    const first = machine.settled();
    const second = machine.settled();

    machine.controls.complete("done");

    const outcome = await first;
    expect(outcome).toEqual({ type: "completed", payload: "done" });
    expect(await second).toBe(outcome);
    expect(await machine.settled()).toBe(outcome);
  });

  it("resolves with the outcome on terminate, even mid-work", async () => {
    const machine = await startedLinear();
    const outcome = machine.settled();
    void machine.navigate.goToNextStep({ run: () => wait(50) });
    await flush();

    machine.controls.terminate("gone");

    expect(await outcome).toEqual({ type: "terminated", payload: "gone" });
  });

  it("waits for the new run's outcome after a restart", async () => {
    const machine = await startedLinear();
    machine.controls.complete("first");
    machine.controls.restart();
    const next = machine.settled();
    let resolved = false;
    void next.then(() => {
      resolved = true;
    });
    await flush();
    expect(resolved).toBe(false);

    machine.controls.terminate("second");

    expect(await next).toEqual({ type: "terminated", payload: "second" });
  });

  it("rejects with a disposed JourneyError when disposed first, pending or not", async () => {
    const machine = await startedLinear();
    const pending = machine.settled();

    machine.dispose();

    for (const promise of [pending, machine.settled()]) {
      const error: unknown = await promise.catch((e: unknown) => e);
      expect(isJourneyError(error) && error.code).toBe("disposed");
    }
  });

  it("keeps resolving with an outcome reached before dispose", async () => {
    const machine = await startedLinear();
    machine.controls.complete("kept");
    machine.dispose();

    expect(await machine.settled()).toEqual({ type: "completed", payload: "kept" });
  });
});

describe('onError: "terminate"', () => {
  it("leaves the default at stay: a failure keeps the machine running", async () => {
    const { machine } = failing("work");
    await flush();

    expect(await machine.send("WORK")).toMatchObject({ ok: false, reason: "error" });
    expect(machine.getSnapshot().status).toBe("running");
    expect(machine.getSnapshot().machine.outcome).toBeNull();
  });

  it("terminates on failing send work, after the error and the block are reported", async () => {
    const { machine, events } = failing("work", { onError: "terminate" });
    await flush();
    const outcome = machine.settled();

    expect(await machine.send("WORK")).toMatchObject({ ok: false, reason: "error", error: boom });

    expect(await outcome).toEqual({
      type: "terminated",
      payload: { error: boom, phase: "work", stepId: "a" }
    });
    expect(events).toEqual([
      ["status", "running"],
      ["error", "work"],
      ["blocked", "error"],
      ["status", "terminated"]
    ]);
  });

  it.each(["leave", "transition", "enter"] as const)(
    "terminates on a failing %s hook once the move has committed",
    async (phase) => {
      const { machine } = failing(phase, { onError: "terminate" });
      await flush();

      expect(await machine.send("GO")).toMatchObject({ ok: true, to: "b" });

      expect(machine.getSnapshot().currentStep?.id).toBe("b");
      expect(await machine.settled()).toEqual({
        type: "terminated",
        payload: { error: boom, phase, stepId: phase === "leave" ? "a" : "b" }
      });
    }
  );

  it("terminates on failing navigation work", async () => {
    const machine = await startedLinear({ onError: "terminate" });

    await machine.navigate.goToNextStep({
      run: () => {
        throw boom;
      }
    });

    expect(await machine.settled()).toEqual({
      type: "terminated",
      payload: { error: boom, phase: "work", stepId: "a" }
    });
  });

  it("terminates on a work timeout", async () => {
    const machine = await startedLinear({ onError: "terminate", defaultTimeoutMs: 5 });

    await machine.navigate.goToNextStep({ run: () => wait(50) });

    const outcome = await machine.settled();
    expect(outcome.type).toBe("terminated");
    expect((outcome.payload as { error: Error }).error.message).toMatch(/timed out after 5ms/);
  });

  it("terminates on a runaway raised-event cascade", async () => {
    const machine = createGraphJourney(
      {
        initial: "a",
        context: {},
        steps: {
          a: { on: { PING: [{ to: "a", onTransition: ({ raise }) => raise({ type: "PING" }) }] } }
        }
      },
      { onError: "terminate" }
    );
    await flush();

    await machine.send("PING");
    const outcome = await machine.settled();

    expect(outcome).toMatchObject({ type: "terminated", payload: { phase: "raise" } });
    expect(machine.getSnapshot().status).toBe("terminated");
  });

  it("terminates on an always chain past maxAutoSteps", async () => {
    const machine = createGraphJourney(
      {
        initial: "a",
        context: {},
        steps: { a: { always: "b" }, b: { always: "a" } }
      },
      { onError: "terminate", maxAutoSteps: 3 }
    );

    const outcome = await machine.settled();

    expect(outcome).toMatchObject({
      type: "terminated",
      payload: { phase: "always", stepId: "b" }
    });
    expect(machine.getSnapshot().history.timeline).toEqual(["a", "b", "a", "b"]);
  });

  it("does not run the failing step's always move once terminated", async () => {
    let ran = false;
    const machine = createGraphJourney(
      {
        initial: "a",
        context: {},
        steps: {
          a: {
            onEnter: () => {
              throw boom;
            },
            always: {
              run: () => {
                ran = true;
              },
              candidates: [{ to: "b" }]
            }
          },
          b: {}
        }
      },
      { onError: "terminate" }
    );

    expect(await machine.settled()).toMatchObject({ payload: { phase: "enter", stepId: "a" } });
    await flush();
    expect(ran).toBe(false);
    expect(machine.getSnapshot().currentStep?.id).toBe("a");
  });
});
