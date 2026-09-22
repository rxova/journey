import { describe, expect, it, vi } from "vitest";
import { createGraphJourney } from "@rxova/journey-core";
import { flush, startedLinear, wait } from "@rxova/journey-core/testing";

/**
 * A timeout used to reject the send while the work ran on, unobserved, to its
 * own end — a fetch kept downloading, a billed call kept billing. The signal is
 * what lets the work itself stop: it aborts whenever the runtime stops waiting.
 */
function machineWith(run: (args: { signal: AbortSignal }) => unknown, timeoutMs?: number) {
  const seen: AbortSignal[] = [];
  const machine = createGraphJourney({
    initial: "a",
    context: {},
    steps: {
      a: {
        on: {
          GO: {
            run: (args) => {
              seen.push(args.signal);
              return run(args);
            },
            commit: ({ signal }) => {
              seen.push(signal);
            },
            ...(timeoutMs === undefined ? {} : { timeoutMs }),
            candidates: [{ to: "b" }]
          }
        }
      },
      b: { on: { BACK: "a" } }
    }
  });
  machine.controls.start();
  return { machine, seen };
}

describe("work receives an AbortSignal", () => {
  it("hands run and commit the same live signal, fresh for each call", async () => {
    const { machine, seen } = machineWith(() => "done");
    await flush();

    expect(await machine.send("GO")).toMatchObject({ ok: true, to: "b" });
    await machine.send("BACK");
    await machine.send("GO");

    expect(seen).toHaveLength(4);
    expect(seen[0]).toBe(seen[1]);
    expect(seen[2]).toBe(seen[3]);
    expect(seen[0]).not.toBe(seen[2]);
    for (const signal of seen) expect(signal.aborted).toBe(false);
  });

  it("aborts with the timeout error when the work outlives its budget", async () => {
    vi.useFakeTimers();
    let reason: unknown;
    const { machine, seen } = machineWith(
      ({ signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => {
            reason = signal.reason;
            reject(signal.reason as Error);
          });
        }),
      100
    );
    await vi.advanceTimersByTimeAsync(1);

    const moved = machine.send("GO");
    await vi.advanceTimersByTimeAsync(150);
    const result = await moved;

    expect(seen[0]?.aborted).toBe(true);
    expect(reason).toBeInstanceOf(Error);
    expect((reason as Error).message).toMatch(/timed out after 100ms/);
    expect(result).toMatchObject({ ok: false, reason: "error", error: reason });
    vi.useRealTimers();
  });

  it("aborts when the machine is terminated mid-work", async () => {
    const { machine, seen } = machineWith(() => wait(50));
    await flush();

    const moved = machine.send("GO");
    await flush();
    machine.controls.terminate();

    expect(seen[0]?.aborted).toBe(true);
    expect((seen[0]?.reason as Error).name).toBe("AbortError");
    expect(await moved).toMatchObject({ ok: false, reason: "not-running" });
  });

  it("aborts when the machine is disposed mid-work", async () => {
    const { machine, seen } = machineWith(() => wait(50));
    await flush();

    void machine.send("GO");
    await flush();
    machine.dispose();

    expect(seen[0]?.aborted).toBe(true);
  });

  it("leaves a finished call's signal alone when the machine later terminates", async () => {
    const { machine, seen } = machineWith(() => "done");
    await flush();

    await machine.send("GO");
    machine.controls.terminate();

    expect(seen[0]?.aborted).toBe(false);
  });

  it("aborts a failed call's signal only on timeout, not on the failure itself", async () => {
    const { machine, seen } = machineWith(() => {
      throw new Error("boom");
    });
    await flush();

    expect(await machine.send("GO")).toMatchObject({ ok: false, reason: "error" });
    machine.controls.terminate();

    expect(seen[0]?.aborted).toBe(false);
  });
});

describe("navigation work receives an AbortSignal", () => {
  it("aborts on timeout and on dispose", async () => {
    const timed = await startedLinear({ defaultTimeoutMs: 20 });
    let timedOut: AbortSignal | undefined;
    const result = await timed.navigate.goToNextStep({
      run: ({ signal }) => {
        timedOut = signal;
        return wait(100);
      }
    });
    expect(result).toMatchObject({ ok: false, reason: "error" });
    expect(timedOut?.aborted).toBe(true);
    expect((timedOut?.reason as Error).message).toMatch(/timed out after 20ms/);

    const disposed = await startedLinear();
    let cancelled: AbortSignal | undefined;
    void disposed.navigate.goToNextStep({
      run: ({ signal }) => {
        cancelled = signal;
        return wait(50);
      }
    });
    await flush();
    disposed.dispose();
    expect(cancelled?.aborted).toBe(true);
  });

  it("hands commit the signal run received", async () => {
    const machine = await startedLinear();
    const seen: AbortSignal[] = [];

    await machine.navigate.goToNextStep({
      run: ({ signal }) => {
        seen.push(signal);
      },
      commit: ({ signal }) => {
        seen.push(signal);
      }
    });

    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(seen[1]);
    expect(seen[0]?.aborted).toBe(false);
  });
});
