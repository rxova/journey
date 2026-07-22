import { describe, expect, it, vi } from "vitest";
import { createSelectorCache, createSnapshotSource, type JourneyReadable } from "./bindings";

type Snap = { n: number; slice: { id: string } };

/** A machine stub that reports how many core subscriptions are actually open. */
const makeMachine = (initial: Snap = { n: 0, slice: { id: "a" } }) => {
  let snapshot = initial;
  const notifiers = new Set<() => void>();
  let subscribeCalls = 0;

  const machine: JourneyReadable<Snap> = {
    getSnapshot: () => snapshot,
    subscriptions: {
      subscribeSelector: (_selector, listener) => {
        subscribeCalls += 1;
        const notify = () => listener(undefined);
        notifiers.add(notify);
        return () => notifiers.delete(notify);
      }
    }
  };

  return {
    machine,
    publish: (next?: Snap) => {
      snapshot = next ?? { ...snapshot, n: snapshot.n + 1 };
      for (const notify of [...notifiers]) notify();
    },
    get subscribeCalls() {
      return subscribeCalls;
    },
    get openSubscriptions() {
      return notifiers.size;
    }
  };
};

describe("createSnapshotSource", () => {
  it("opens one machine subscription however many listeners attach", () => {
    const host = makeMachine();
    const source = createSnapshotSource(host.machine);
    const listeners = [vi.fn(), vi.fn(), vi.fn()];
    const releases = listeners.map((fn) => source.subscribe(fn));

    expect(host.subscribeCalls).toBe(1);
    expect(host.openSubscriptions).toBe(1);
    expect(source.listenerCount).toBe(3);

    host.publish();
    for (const fn of listeners) expect(fn).toHaveBeenCalledOnce();

    for (const release of releases) release();
    expect(source.listenerCount).toBe(0);
    expect(host.openSubscriptions).toBe(0);
  });

  it("releases the machine subscription only when the last listener leaves", () => {
    const host = makeMachine();
    const source = createSnapshotSource(host.machine);
    const releaseFirst = source.subscribe(vi.fn());
    const releaseSecond = source.subscribe(vi.fn());

    releaseFirst();
    expect(host.openSubscriptions).toBe(1);
    releaseSecond();
    expect(host.openSubscriptions).toBe(0);
  });

  it("resubscribes when a listener attaches after the last one left", () => {
    const host = makeMachine();
    const source = createSnapshotSource(host.machine);
    source.subscribe(vi.fn())();

    const listener = vi.fn();
    source.subscribe(listener);
    expect(host.subscribeCalls).toBe(2);

    host.publish();
    expect(listener).toHaveBeenCalledOnce();
  });

  it("ignores a repeated release", () => {
    const host = makeMachine();
    const source = createSnapshotSource(host.machine);
    const stay = vi.fn();
    source.subscribe(stay);
    const release = source.subscribe(vi.fn());

    release();
    release();
    expect(source.listenerCount).toBe(1);
    expect(host.openSubscriptions).toBe(1);
  });

  it("keeps the current pass stable when a listener unsubscribes mid-notification", () => {
    const host = makeMachine();
    const source = createSnapshotSource(host.machine);
    const later = vi.fn();
    let releaseLater: (() => void) | undefined;

    source.subscribe(() => releaseLater?.());
    releaseLater = source.subscribe(later);

    // The set is copied before notifying, so the removal lands on the next pass.
    host.publish();
    expect(later).toHaveBeenCalledOnce();
    host.publish();
    expect(later).toHaveBeenCalledOnce();
  });

  it("runs every listener even when one throws, then surfaces the error", () => {
    const host = makeMachine();
    const source = createSnapshotSource(host.machine);
    const after = vi.fn();
    source.subscribe(() => {
      throw new Error("listener exploded");
    });
    source.subscribe(after);

    expect(() => host.publish()).toThrow(/listener exploded/);
    expect(after).toHaveBeenCalledOnce();
  });

  it("reads the machine's current snapshot", () => {
    const host = makeMachine();
    const source = createSnapshotSource(host.machine);
    expect(source.getSnapshot().n).toBe(0);
    host.publish();
    expect(source.getSnapshot().n).toBe(1);
  });
});

describe("createSelectorCache", () => {
  it("skips the selector for a repeated snapshot", () => {
    const selector = vi.fn((snapshot: Snap) => snapshot.n);
    const select = createSelectorCache(selector);
    const snapshot: Snap = { n: 5, slice: { id: "a" } };

    expect(select(snapshot, null)).toBe(5);
    expect(select(snapshot, null)).toBe(5);
    expect(selector).toHaveBeenCalledOnce();
  });

  it("reuses the committed reference when equality says the slice is unchanged", () => {
    const select = createSelectorCache(
      (snapshot: Snap) => ({ id: snapshot.slice.id }),
      (a, b) => a.id === b.id
    );
    const committedValue = { id: "a" };

    const first = select({ n: 1, slice: { id: "a" } }, { value: committedValue });
    expect(first).toBe(committedValue);

    const changed = select({ n: 2, slice: { id: "b" } }, { value: committedValue });
    expect(changed).not.toBe(committedValue);
    expect(changed).toEqual({ id: "b" });
  });

  it("returns a fresh value when there is no committed baseline yet", () => {
    const select = createSelectorCache((snapshot: Snap) => ({ id: snapshot.slice.id }));
    expect(select({ n: 1, slice: { id: "a" } }, null)).toEqual({ id: "a" });
  });

  it("defaults to Object.is when no equality function is supplied", () => {
    const select = createSelectorCache((snapshot: Snap) => snapshot.n);
    const committed = { value: 7 };
    expect(select({ n: 7, slice: { id: "a" } }, committed)).toBe(7);
    expect(select({ n: 8, slice: { id: "a" } }, committed)).toBe(8);
  });
});
