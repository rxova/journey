export const resolveWindowTargetOrigin = (): string => {
  /* v8 ignore next 3 -- browser-only; SSR callers return before posting. */
  if (typeof window === "undefined") {
    return "*";
  }
  return window.location.origin === "null" ? "*" : window.location.origin;
};

export const isExpectedWindowOrigin = (origin: string): boolean => {
  if (origin.length === 0 || typeof window === "undefined") {
    return false;
  }
  const expected = window.location.origin;
  if (expected === "null") {
    return origin === "null";
  }
  return origin === expected;
};
