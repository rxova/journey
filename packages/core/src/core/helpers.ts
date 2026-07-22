import type { StepAsyncState } from "./types";

/** Hard cap on events processed from one raise cascade before it is dropped. */
export const MAX_RAISED_EVENTS = 25;

/**
 * Key for definition-declared send work. Work belongs to an (origin step,
 * event) pair, not to an event alone — the same event name can be declared
 * from several steps with different work on each. Length-prefixing the step id
 * keeps the key injective without reserving a separator character.
 */
export const eventWorkKey = (from: string, event: string): string =>
  `${from.length}:${from}${event}`;

export const SUCCESS_ASYNC: StepAsyncState = Object.freeze({
  isLoading: false,
  isSuccess: true,
  isError: false,
  error: null
});

export const LOADING_ASYNC: StepAsyncState = Object.freeze({
  isLoading: true,
  isSuccess: false,
  isError: false,
  error: null
});

/**
 * Own-property membership, for every guard that asks "is this a declared id?".
 *
 * `in` walks the prototype chain, so `"toString" in steps` is true for any
 * object literal. Using it to validate step ids let `toString`, `constructor`,
 * `__proto__`, `hasOwnProperty` and friends pass as declared steps — including
 * ids arriving from a persisted record or a route parameter, which are not
 * developer-authored. Own-property checks are the only correct test here.
 *
 * `Object.prototype.hasOwnProperty.call` rather than `Object.hasOwn` because
 * the compilation target is ES2020 and `Object.hasOwn` is ES2022.
 */
export const hasOwn = (target: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(target, key);

/** Subscriber exceptions are isolated so one listener cannot break the pipeline. */
export function reportListenerError(error: unknown): void {
  console.error("[journey] subscriber threw:", error);
}

/**
 * Object.is over own enumerable keys — for flat snapshot sub-objects. The
 * key check is load-bearing: equal key counts alone would call `{a: undefined}`
 * and `{b: undefined}` equal, since both read `undefined` at every compared key.
 */
export const shallowEqual = (
  a: Readonly<Record<string, unknown>>,
  b: Readonly<Record<string, unknown>>
): boolean => {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => hasOwn(b, key) && Object.is(a[key], b[key]));
};
