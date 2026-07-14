import { reportListenerError } from "./helpers";
import type { SelectorEntry } from "./store.types";
import type {
  JourneyEventPayloads,
  JourneySnapshot,
  JourneySubscriptionEvent,
  Unsubscribe
} from "./types";

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

  constructor(initial: JourneySnapshot<TContext, TStepId>) {
    this.snapshot = initial;
  }

  getSnapshot(): JourneySnapshot<TContext, TStepId> {
    return this.snapshot;
  }

  /** Replaces the snapshot and notifies selector subscribers whose value changed. */
  publish(next: JourneySnapshot<TContext, TStepId>): void {
    this.snapshot = next;
    for (const entry of [...this.selectorEntries]) {
      let selected: unknown;
      try {
        selected = entry.selector(next);
      } catch (error) {
        reportListenerError(error);
        continue;
      }
      if (entry.equals(entry.last, selected)) continue;
      entry.last = selected;
      try {
        (entry.listener as (value: unknown) => void)(selected);
      } catch (error) {
        reportListenerError(error);
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
        reportListenerError(error);
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    this.selectorEntries.clear();
    this.eventListeners.clear();
  }
}
