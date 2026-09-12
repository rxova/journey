/**
 * Origin handling for `window.postMessage` traffic.
 *
 * Both directions of a `postMessage` channel need an origin decision, and both
 * have to cope with the opaque `"null"` origin that sandboxed iframes,
 * `data:` documents, and `file://` pages report. The two helpers here are
 * asymmetric on purpose: sending degrades to a wildcard so the channel still
 * works, receiving refuses anything it cannot positively match.
 */

/**
 * Picks the `targetOrigin` for an outgoing `postMessage`.
 *
 * A real origin is used verbatim so the message cannot be read by another
 * origin. The opaque `"null"` origin is not a valid `targetOrigin` and would
 * throw, so it degrades to `"*"` — the alternative is a devtools channel that
 * simply does not work on `file://` pages.
 *
 * @returns The current origin, or `"*"` when there is no usable one.
 */
export const resolveWindowTargetOrigin = (): string => {
  if (typeof window === "undefined") {
    return "*";
  }
  return window.location.origin === "null" ? "*" : window.location.origin;
};

/**
 * Checks whether an incoming message's origin is this window's own.
 *
 * Unlike {@link resolveWindowTargetOrigin} this never degrades: an empty
 * origin, or any call outside a browser, is rejected. The `"null"` origin is
 * accepted only when this window is *also* opaque, which keeps sandboxed pages
 * talking to themselves without letting an arbitrary opaque frame in.
 *
 * @param origin - The `origin` field of a received `MessageEvent`.
 * @returns `true` only when the origin positively matches this window's.
 */
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
