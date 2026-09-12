/** Compares two selected values; `Object.is` unless a caller supplies its own. */
export type EqualityFn<TSelected> = (a: TSelected, b: TSelected) => boolean;

/**
 * A cache for one `(selector, equalityFn)` pair. `committed` is the last value
 * React actually committed, or null before the first commit.
 */
export type SelectorCache<TSnapshot, TSelected> = (
  snapshot: TSnapshot,
  committed: { readonly value: TSelected } | null
) => TSelected;

/**
 * Builds the selection cache for one `(selector, equalityFn)` pair. Two jobs,
 * deliberately separate:
 *
 * - **Same-snapshot short circuit.** Core shares snapshot structure, so an
 *   unchanged snapshot is reference-equal and re-running the selector for it is
 *   waste. It also matters for correctness here: `useSyncExternalStore` calls
 *   `getSnapshot` more than once per render and requires a stable result.
 * - **Committed-value reuse.** A selector deriving a fresh object each run
 *   (`(s) => ({ id: s.currentStep?.id })`) needs equality to collapse it back to
 *   the previously committed reference, or every publish looks like a change.
 *   The committed value is passed in rather than stored, because only React
 *   knows which renders committed — reusing a value from a render that was
 *   discarded is exactly the staleness this avoids.
 *
 * Rebuild the cache when the selector or equality function changes identity.
 *
 * Lives in this package rather than core: core publishes snapshots and nothing
 * else, and selection-with-memoised-identity is a rendering concern. Core's
 * `subscriptions.subscribe` fires on every commit and the derivation happens
 * here, where the committed baseline is knowable.
 *
 * @typeParam TSnapshot - The machine's snapshot type.
 * @typeParam TSelected - The derived slice type.
 * @param selector - Derives the slice. Must be pure; it is skipped for a repeated snapshot.
 * @param equalityFn - Compares a fresh selection against the committed one. Defaults to `Object.is`.
 * @returns A cache for this one `(selector, equalityFn)` pair, not safe to share across pairs.
 */
export const createSelectorCache = <TSnapshot, TSelected>(
  selector: (snapshot: TSnapshot) => TSelected,
  equalityFn?: EqualityFn<TSelected>
): SelectorCache<TSnapshot, TSelected> => {
  let cached: { snapshot: TSnapshot; selected: TSelected } | null = null;

  return (snapshot, committed) => {
    if (cached !== null && Object.is(cached.snapshot, snapshot)) return cached.selected;

    const next = selector(snapshot);
    const isEqual = equalityFn ?? Object.is;
    const selected = committed !== null && isEqual(committed.value, next) ? committed.value : next;
    cached = { snapshot, selected };
    return selected;
  };
};
