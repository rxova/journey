/**
 * Framework-agnostic pieces of a journey binding.
 *
 * A framework wrapper is mostly glue — hooks, components, reactivity — but two
 * parts underneath it are pure logic and identical for React, Vue, or Angular:
 * multiplexing one machine subscription across many views, and caching a
 * derived selection so an unchanged slice does not churn its reference. Those
 * live here so the second wrapper inherits them rather than reimplementing
 * them, subtly differently.
 */

/**
 * The read surface a binding drives a machine through. Core machines satisfy it
 * structurally; it is deliberately the narrowest useful shape, so a wrapper
 * needing `navigate` or `send` reaches for the concrete machine type instead.
 */
export type JourneyReadable<TSnapshot> = {
  getSnapshot(): TSnapshot;
  subscriptions: {
    subscribeSelector(
      selector: (snapshot: TSnapshot) => unknown,
      listener: (selected: unknown) => void
    ): () => void;
  };
};

/** A subscribe/read pair over one machine, shared by every view bound to it. */
export type SnapshotSource<TSnapshot> = {
  /** The machine's current snapshot. Safe to call during a render pass. */
  getSnapshot: () => TSnapshot;
  /**
   * Registers a change listener. Every listener shares one machine
   * subscription, opened on the first and released on the last. Releasing
   * twice is a no-op.
   */
  subscribe: (listener: () => void) => () => void;
  /** Live listener count — for tests and diagnostics, not control flow. */
  readonly listenerCount: number;
};

/** Compares two selected values; `Object.is` unless a caller supplies its own. */
export type EqualityFn<TSelected> = (a: TSelected, b: TSelected) => boolean;

/**
 * A cache for one `(selector, equalityFn)` pair. `committed` is the last value
 * the host framework actually committed, or null before the first commit.
 */
export type SelectorCache<TSnapshot, TSelected> = (
  snapshot: TSnapshot,
  committed: { readonly value: TSelected } | null
) => TSelected;

const identity = <TSnapshot>(snapshot: TSnapshot): TSnapshot => snapshot;

/**
 * Multiplexes one machine subscription across every listener a wrapper opens.
 *
 * Subscribing per view makes core run one selector and one equality check *per
 * subscriber* on every publish — O(n) work for a change that is identical for
 * all of them. This subscribes once and fans out, so the machine's cost per
 * publish stays constant however many views are mounted.
 *
 * Listeners are copied before notification, so subscribing or unsubscribing
 * from inside a listener affects the next publish instead of corrupting the
 * current one. A throwing listener does not stop the rest; the first error is
 * rethrown after the pass so the wrapper's error handling still sees it.
 *
 * @typeParam TSnapshot - The machine's snapshot type.
 * @param machine - The machine to read and subscribe to. Held for the lifetime of the source.
 * @returns A source whose machine subscription opens on the first listener and closes with the last.
 */
export const createSnapshotSource = <TSnapshot>(
  machine: JourneyReadable<TSnapshot>
): SnapshotSource<TSnapshot> => {
  const listeners = new Set<() => void>();
  let release: (() => void) | null = null;

  const notify = () => {
    let failure: { error: unknown } | null = null;
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        failure ??= { error };
      }
    }
    if (failure !== null) throw failure.error;
  };

  return {
    getSnapshot: () => machine.getSnapshot(),

    subscribe: (listener: () => void) => {
      // Open the machine subscription first. Registering the listener before
      // this call would strand it in the set if the machine refuses, leaving a
      // count that never returns to zero and a subscription never released.
      release ??= machine.subscriptions.subscribeSelector(identity, notify);
      listeners.add(listener);

      let released = false;
      return () => {
        if (released) return;
        released = true;
        listeners.delete(listener);
        if (listeners.size === 0 && release !== null) {
          const dispose = release;
          release = null;
          dispose();
        }
      };
    },

    get listenerCount() {
      return listeners.size;
    }
  };
};

/**
 * Builds the selection cache for one `(selector, equalityFn)` pair. Two jobs,
 * deliberately separate:
 *
 * - **Same-snapshot short circuit.** Core shares snapshot structure, so an
 *   unchanged snapshot is reference-equal and re-running the selector for it is
 *   waste.
 * - **Committed-value reuse.** A selector deriving a fresh object each run
 *   (`(s) => ({ id: s.currentStep?.id })`) needs equality to collapse it back to
 *   the previously committed reference, or every publish looks like a change.
 *   The committed value is passed in rather than stored, because only the host
 *   framework knows which renders committed — reusing a value from a render
 *   that was discarded is exactly the staleness this avoids.
 *
 * Rebuild the cache when the selector or equality function changes identity.
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
