/**
 * Wraps a single-argument function so that consecutive calls with the same
 * argument — compared by `Object.is` identity — return the previously computed
 * result instead of recomputing. Only the most recent call is cached.
 *
 * Designed for values keyed on stable, immutable references such as a frozen
 * snapshot whose identity only changes when state changes. Memoizing on that
 * identity hands framework adapters (React `useSyncExternalStore`, Vue
 * `computed`, Angular signals) referential stability for free.
 */
export const memoizeByIdentity = <TArg, TResult>(
  fn: (arg: TArg) => TResult
): ((arg: TArg) => TResult) => {
  let hasCache = false;
  let cachedArg: TArg;
  let cachedResult: TResult;

  return (arg: TArg) => {
    if (hasCache && Object.is(cachedArg, arg)) {
      return cachedResult;
    }

    cachedArg = arg;
    cachedResult = fn(arg);
    hasCache = true;
    return cachedResult;
  };
};
