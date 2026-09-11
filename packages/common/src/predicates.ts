/**
 * Narrowing predicates for values that arrive untyped — parsed JSON, a
 * `postMessage` payload, a caught `unknown`.
 *
 * Each one is deliberately literal about what it checks, because the useful
 * distinction at a boundary is rarely "is this my type" but "is this safe to
 * index into".
 */

/**
 * Narrows a value to something indexable by string key.
 *
 * This is the `typeof value === "object" && value !== null` check, named. It is
 * intentionally broad: arrays, class instances, and null-prototype objects all
 * pass, because all of them are safe to read a property off. Reach for
 * {@link isPlainObject} when the distinction actually matters.
 *
 * @param value - Any value.
 * @returns `true` for any non-null object, including arrays.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Narrows a value to a plain data object — an object literal, a
 * `JSON.parse` result, or an `Object.create(null)` bag.
 *
 * Unlike {@link isRecord}, arrays and class instances are rejected. Use this
 * when the next step treats the value as an open map of fields, where a `Date`
 * or a `Map` would be silently mangled by key-wise iteration.
 *
 * @param value - Any value.
 * @returns `true` only for objects whose prototype is `Object.prototype` or `null`.
 */
export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
