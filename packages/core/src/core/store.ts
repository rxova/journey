import { reportListenerError } from "./helpers.js";
import type { SelectorEntry } from "./store.types.js";
import type {
  JourneyEventPayloads,
  JourneySnapshot,
  JourneySubscriptionEvent,
  Unsubscribe
} from "./types.js";

/**
 * Snapshot holder + subscription hub. Snapshots are immutable and rebuilt by
 * the runtime; the store only distributes them.
 */
export class JourneyStore<TContext, TStepId extends string> {
  private snapshot: JourneySnapshot<TContext, TStepId>;
  private readonly selectorEntries = new Set<SelectorEntry<TContext, TStepId>>();
  private readonly eventListeners = new Map<
    JourneySubscriptionEvent,
    Set<(payload: never) => void>
  >();
  private disposed = false;
  private readonly onListenerError: ((error: unknown) => void) | undefined;

  constructor(
    initial: JourneySnapshot<TContext, TStepId>,
    onListenerError?: (error: unknown) => void
  ) {
    this.snapshot = initial;
    this.onListenerError = onListenerError;
  }

  /** Isolation stays unconditional; the configured reporter only routes the report. */
  private report(error: unknown): void {
    if (!this.onListenerError) {
      reportListenerError(error);
      return;
    }
    try {
      this.onListenerError(error);
    } catch (reporterError) {
      reportListenerError(reporterError);
    }
  }

  getSnapshot(): JourneySnapshot<TContext, TStepId> {
    return this.snapshot;
  }

  /** Replaces the snapshot and notifies selector subscribers whose value changed. */
  publish(next: JourneySnapshot<TContext, TStepId>): void {
    // Structural sharing upstream returns the previous object verbatim when
    // nothing changed — such publishes are complete no-ops.
    if (Object.is(this.snapshot, next)) return;
    this.snapshot = next;
    for (const entry of [...this.selectorEntries]) {
      let selected: unknown;
      try {
        selected = entry.selector(next);
      } catch (error) {
        this.report(error);
        continue;
      }
      if (entry.equals(entry.last, selected)) continue;
      entry.last = selected;
      try {
        (entry.listener as (value: unknown) => void)(selected);
      } catch (error) {
        this.report(error);
      }
    }
  }

  subscribeSelector<TSelected>(
    selector: (snapshot: JourneySnapshot<TContext, TStepId>) => TSelected,
    listener: (selected: TSelected) => void,
    equals: (a: TSelected, b: TSelected) => boolean = Object.is
  ): Unsubscribe {
    if (this.disposed) return () => undefined;
    const entry: SelectorEntry<TContext, TStepId> = {
      selector,
      listener: listener as (selected: never) => void,
      equals: equals as (a: unknown, b: unknown) => boolean,
      last: selector(this.snapshot)
    };
    this.selectorEntries.add(entry);
    return () => {
      this.selectorEntries.delete(entry);
    };
  }

  subscribeEvent<TEvent extends JourneySubscriptionEvent>(
    event: TEvent,
    listener: (payload: JourneyEventPayloads<TContext, TStepId>[TEvent]) => void
  ): Unsubscribe {
    if (this.disposed) return () => undefined;
    let listeners = this.eventListeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this.eventListeners.set(event, listeners);
    }
    listeners.add(listener as (payload: never) => void);
    return () => {
      listeners.delete(listener as (payload: never) => void);
    };
  }

  emit<TEvent extends JourneySubscriptionEvent>(
    event: TEvent,
    payload: JourneyEventPayloads<TContext, TStepId>[TEvent]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (!listeners) return;
    for (const listener of [...listeners]) {
      try {
        (listener as (value: unknown) => void)(payload);
      } catch (error) {
        this.report(error);
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    this.selectorEntries.clear();
    this.eventListeners.clear();
  }
}
