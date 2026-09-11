import { reportListenerError } from "./helpers";
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
  private readonly listeners = new Set<() => void>();
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

  /**
   * Isolation stays unconditional; the configured reporter only routes the
   * report. Internal, but reachable from the runtime so plugin-boundary
   * failures land in the same place as subscriber failures.
   */
  report(error: unknown): void {
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

  /** Replaces the snapshot and notifies every subscriber. */
  publish(next: JourneySnapshot<TContext, TStepId>): void {
    // Structural sharing upstream returns the previous object verbatim when
    // nothing changed — such publishes are complete no-ops.
    if (Object.is(this.snapshot, next)) return;
    this.snapshot = next;
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (error) {
        this.report(error);
      }
    }
  }

  /**
   * Notifies on every committed snapshot. Deriving a slice and skipping
   * unchanged values is the caller's job — in React that is `useSelector`,
   * which has to own the comparison anyway to keep render identity stable.
   */
  subscribe(listener: () => void): Unsubscribe {
    if (this.disposed) return () => undefined;
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
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
    this.listeners.clear();
    this.eventListeners.clear();
  }
}
