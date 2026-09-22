import { JourneyError } from "./errors";

/** How {@link retry} re-runs a failed `run`. */
export type RetryOptions = {
  /** Total tries, the first included: a positive integer. */
  readonly attempts: number;
  /**
   * Wait before the next try, in milliseconds, or a function of the attempt
   * that just failed (1-based) for a backoff. Defaults to no wait.
   */
  readonly delayMs?: number | ((attempt: number) => number);
  /**
   * Whether a failure is worth another try; defaults to every failure. A
   * `false` rethrows at once, so a validation error does not burn attempts.
   */
  readonly when?: (error: unknown, attempt: number) => boolean;
  /**
   * Budget for one try. A try that outlives it is aborted and counts as a
   * failure. The work's own `timeoutMs` still bounds every try together.
   */
  readonly timeoutMs?: number;
};

const isPositiveFinite = (value: number): boolean => value > 0 && Number.isFinite(value);

/**
 * Resolves after `ms`, or rejects with the signal's reason as soon as it aborts.
 * Only called on a live signal: the retry loop checks `aborted` first.
 */
const pause = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason as unknown);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });

/**
 * Wraps a work `run` so a failure tries it again, up to `attempts` tries in
 * all. Each try gets a signal of its own, aborted by its `timeoutMs` and by the
 * signal the runtime passed in, and the 1-based `attempt` number. The delay
 * between tries is cut short by that same outer signal, so terminating the
 * machine stops a retry loop mid-wait. The last failure is rethrown as is.
 *
 * `commit` is not wrapped: it runs once, on the result of the try that
 * succeeded. `defineWork` cannot read that result's type through the wrapper;
 * declare it in the bag's `results` instead.
 *
 * @example
 * ```ts
 * SUBMIT: {
 *   run: retry(({ handlers, signal }) => handlers.api.submit({ signal }), {
 *     attempts: 3,
 *     delayMs: (attempt) => 200 * 2 ** attempt,
 *     when: (error) => !(error instanceof ValidationError)
 *   }),
 *   candidates: [{ to: "done" }]
 * }
 * ```
 */
export function retry<TArgs extends { readonly signal: AbortSignal }, TResult>(
  // NoInfer: the work's own args come from where the wrapper is declared, never
  // from `run`'s annotation, which also names `attempt`.
  run: (args: NoInfer<TArgs> & { readonly attempt: number }) => TResult | PromiseLike<TResult>,
  options: RetryOptions
): (args: TArgs) => Promise<TResult> {
  const { attempts, delayMs = 0, when = () => true, timeoutMs } = options;
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new JourneyError(
      "invalid-retry",
      `retry: attempts must be a positive integer, got ${String(attempts)}`
    );
  }
  if (timeoutMs !== undefined && !isPositiveFinite(timeoutMs)) {
    throw new JourneyError(
      "invalid-retry",
      `retry: timeoutMs must be a positive finite number, got ${String(timeoutMs)}`
    );
  }

  const once = (args: TArgs, attempt: number): Promise<TResult> => {
    const controller = new AbortController();
    const forward = () => {
      controller.abort(args.signal.reason);
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    return new Promise<TResult>((resolve, reject) => {
      controller.signal.addEventListener("abort", () => {
        reject(controller.signal.reason as unknown);
      });
      if (args.signal.aborted) forward();
      else args.signal.addEventListener("abort", forward, { once: true });
      if (timeoutMs !== undefined) {
        timer = setTimeout(() => {
          controller.abort(
            new Error(
              `journey: retry attempt ${String(attempt)} timed out after ${String(timeoutMs)}ms`
            )
          );
        }, timeoutMs);
      }
      Promise.resolve()
        .then(() => {
          // Aborted before the try began: it already rejected, so never start it.
          controller.signal.throwIfAborted();
          return run({ ...args, signal: controller.signal, attempt });
        })
        .then(resolve, reject);
    }).finally(() => {
      clearTimeout(timer);
      args.signal.removeEventListener("abort", forward);
    });
  };

  return async (args) => {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await once(args, attempt);
      } catch (error) {
        if (args.signal.aborted || attempt >= attempts || !when(error, attempt)) throw error;
        await pause(typeof delayMs === "function" ? delayMs(attempt) : delayMs, args.signal);
      }
    }
  };
}
