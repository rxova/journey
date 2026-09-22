import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { createGraphJourney, isJourneyError, retry, withGraphTypes } from "@rxova/journey-core";
import { flush, startedLinear, wait } from "@rxova/journey-core/testing";

const live = () => new AbortController().signal;

/** A run that fails `failures` times, then returns `"ok"`; it records each try. */
function flaky(failures: number) {
  const tries: { attempt: number; signal: AbortSignal }[] = [];
  const run = ({ attempt, signal }: { attempt: number; signal: AbortSignal }) => {
    tries.push({ attempt, signal });
    if (tries.length <= failures) throw new Error(`fail ${String(tries.length)}`);
    return "ok";
  };
  return { run, tries };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("retry", () => {
  it("tries again until a try succeeds, each with its own signal and attempt", async () => {
    const { run, tries } = flaky(2);
    const outer = live();

    expect(await retry(run, { attempts: 3 })({ signal: outer })).toBe("ok");

    expect(tries.map((t) => t.attempt)).toEqual([1, 2, 3]);
    expect(new Set(tries.map((t) => t.signal)).size).toBe(3);
    expect(tries.every((t) => t.signal !== outer)).toBe(true);
  });

  it("rethrows the last failure once attempts run out", async () => {
    const { run, tries } = flaky(5);

    await expect(retry(run, { attempts: 2 })({ signal: live() })).rejects.toThrow("fail 2");
    expect(tries).toHaveLength(2);
  });

  it("stops at once when when() declines the failure", async () => {
    const { run, tries } = flaky(5);
    const when = vi.fn((_error: unknown, attempt: number) => attempt < 2);

    await expect(retry(run, { attempts: 5, when })({ signal: live() })).rejects.toThrow("fail 2");
    expect(tries).toHaveLength(2);
    expect(when.mock.calls.map(([error, attempt]) => [(error as Error).message, attempt])).toEqual([
      ["fail 1", 1],
      ["fail 2", 2]
    ]);
  });

  it("waits delayMs between tries, or what a function of the attempt returns", async () => {
    vi.useFakeTimers();
    const fixed = flaky(1);
    const pending = retry(fixed.run, { attempts: 2, delayMs: 100 })({ signal: live() });
    await vi.advanceTimersByTimeAsync(99);
    expect(fixed.tries).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toBe("ok");

    const backoff = flaky(2);
    const delayMs = vi.fn((attempt: number) => attempt * 10);
    const later = retry(backoff.run, { attempts: 3, delayMs })({ signal: live() });
    await vi.advanceTimersByTimeAsync(30);
    expect(await later).toBe("ok");
    expect(delayMs.mock.calls).toEqual([[1], [2]]);
  });

  it("aborts a try that outlives its timeoutMs and counts it as a failure", async () => {
    const seen: AbortSignal[] = [];
    const run = retry(
      ({ attempt, signal }: { attempt: number; signal: AbortSignal }) => {
        seen.push(signal);
        return attempt === 1 ? wait(50).then(() => "first") : "second";
      },
      { attempts: 2, timeoutMs: 5 }
    );

    expect(await run({ signal: live() })).toBe("second");
    expect(seen[0]?.aborted).toBe(true);
    expect((seen[0]?.reason as Error).message).toBe("journey: retry attempt 1 timed out after 5ms");
    expect(seen[1]?.aborted).toBe(false);
  });

  it("stops with the outer signal's reason: mid-try, mid-wait, or before it starts", async () => {
    const midTry = new AbortController();
    let inner: AbortSignal | undefined;
    const running = retry(
      ({ signal }: { signal: AbortSignal }) => {
        inner = signal;
        return wait(50);
      },
      { attempts: 3 }
    )({ signal: midTry.signal });
    await flush();
    midTry.abort(new Error("stop"));
    await expect(running).rejects.toThrow("stop");
    expect(inner?.aborted).toBe(true);

    const midWait = new AbortController();
    const { run, tries } = flaky(5);
    const waiting = retry(run, { attempts: 3, delayMs: 1_000 })({ signal: midWait.signal });
    await flush();
    midWait.abort(new Error("gone"));
    await expect(waiting).rejects.toThrow("gone");
    expect(tries).toHaveLength(1);

    const before = new AbortController();
    before.abort(new Error("never"));
    const never = flaky(0);
    await expect(retry(never.run, { attempts: 3 })({ signal: before.signal })).rejects.toThrow(
      "never"
    );
    expect(never.tries).toHaveLength(0);
  });

  it.each([
    [{ attempts: 0 }, /attempts must be a positive integer, got 0/],
    [{ attempts: 1.5 }, /attempts must be a positive integer/],
    [{ attempts: 2, timeoutMs: 0 }, /timeoutMs must be a positive finite number, got 0/],
    [{ attempts: 2, timeoutMs: Infinity }, /timeoutMs must be a positive finite number/]
  ])("rejects %o as invalid-retry when the wrapper is built", (options, message) => {
    try {
      retry(() => "x", options);
      expect.unreachable();
    } catch (error) {
      expect(isJourneyError(error) && error.code).toBe("invalid-retry");
      expect((error as Error).message).toMatch(message);
    }
  });
});

describe("retry as work", () => {
  it("retries a send's run, commits once, and routes on the successful result", async () => {
    const { run, tries } = flaky(2);
    const commit = vi.fn();
    const machine = createGraphJourney({
      initial: "a",
      context: {},
      steps: {
        a: { on: { GO: { run: retry(run, { attempts: 3 }), commit, candidates: [{ to: "b" }] } } },
        b: {}
      }
    });
    await flush();

    expect(await machine.send("GO")).toMatchObject({ ok: true, to: "b" });
    expect(tries).toHaveLength(3);
    expect(commit).toHaveBeenCalledOnce();
    expect(commit.mock.calls[0]?.[0]).toMatchObject({ result: "ok" });
  });

  it("stays working across tries, and terminate cancels the wait between them", async () => {
    const { run, tries } = flaky(5);
    const machine = await startedLinear();

    const moved = machine.navigate.goToNextStep({ run: retry(run, { attempts: 3, delayMs: 20 }) });
    await wait(5);
    expect(machine.getSnapshot().transition.phase).toBe("working");
    machine.controls.terminate();
    await wait(40);

    expect(await moved).toMatchObject({ ok: false, reason: "not-running" });
    expect(tries).toHaveLength(1);
  });

  it("types the wrapper from the work it is declared on", () => {
    type LoadBag = {
      context: Record<string, never>;
      stepId: "a" | "b";
      events: { type: "GO" };
      handlers: { readonly load: (signal: AbortSignal) => Promise<number> };
      results: { GO: number };
    };
    withGraphTypes<LoadBag>()(
      {
        initial: "a",
        context: {},
        steps: {
          a: {
            on: {
              GO: {
                run: retry(
                  ({ handlers, signal, attempt }) => {
                    expectTypeOf(attempt).toEqualTypeOf<number>();
                    return handlers.load(signal);
                  },
                  { attempts: 2 }
                ),
                commit: ({ result }) => {
                  expectTypeOf(result).toEqualTypeOf<number>();
                },
                candidates: [{ to: "b" }]
              }
            }
          },
          b: {}
        }
      },
      { handlers: { load: () => Promise.resolve(1) } }
    );
  });
});
