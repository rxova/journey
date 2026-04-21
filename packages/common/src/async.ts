const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const withTimeout = async <T>(
  promise: PromiseLike<T>,
  timeoutMs: number | undefined,
  buildError: () => Error
): Promise<T> => {
  if (!isFiniteNumber(timeoutMs) || timeoutMs <= 0) {
    return await promise;
  }

  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(buildError());
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
};

export const withAbortSignal = async <T>(
  promise: PromiseLike<T>,
  signal: AbortSignal
): Promise<T> => {
  if (signal.aborted) {
    throw signal.reason;
  }

  return await new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(signal.reason);
    };

    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
};
