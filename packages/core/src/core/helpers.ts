import type { RuntimeTransition } from "./runtime.types";
import type { StepAsyncState, TransitionInfo } from "./types";

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

/**
 * How one edge is named in errors and timeout messages.
 *
 * A declared label wins outright — that is the point of declaring one. Without
 * it the fallback still has to distinguish candidates that share an event and
 * a target and differ only by guard, so it carries the declaration index:
 * `submit[1] (login -> twofa)`.
 */
export const describeTransition = (transition: RuntimeTransition): string =>
  transition.label ??
  `${transition.event}[${transition.index}] (${transition.from} -> ${transition.to})`;

/**
 * The public, generics-free view of an edge handed to step hooks. Built once
 * per navigation and shared by the three hooks it runs — and left unfrozen,
 * like the hook args it rides on, since it does not outlive them.
 */
export const transitionInfo = (transition: RuntimeTransition | null): TransitionInfo | null =>
  transition === null
    ? null
    : {
        event: transition.event,
        from: transition.from,
        to: transition.to,
        label: transition.label ?? null,
        index: transition.index
      };

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
 */
export const hasOwn = (target: object, key: string): boolean => Object.hasOwn(target, key);

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
