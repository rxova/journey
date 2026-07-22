import { describe, expect, it } from "vitest";
import { createLinearJourney } from "@rxova/journey-core";
import { createPersistencePlugin, parsePersistedState } from "@rxova/journey-core/persistence";
import { flush } from "@rxova/journey-core/testing";
import type { JourneyStorage, PersistenceState } from "@rxova/journey-core/persistence";

const KEY = "journey";

function storageThatFails(mode: "sync" | "async"): JourneyStorage {
  return {
    getItem: () => null,
    setItem: () => {
      const error = new Error("quota exceeded");
      if (mode === "sync") throw error;
      return Promise.reject(error);
    },
    removeItem: () => undefined
  };
}

describe("persistence write state", () => {
  it("does not report a save time for a write that never landed", async () => {
    const reported: unknown[] = [];
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: { n: 0 } },
      {
        plugins: [
          createPersistencePlugin({ key: KEY, storage: storageThatFails("async") })
        ] as const,
        onListenerError: (error) => reported.push(error)
      }
    );
    machine.controls.start();
    await flush();
    await machine.navigate.goToNextStep();
    await flush();

    // Previously lastWritten was assigned before the write was attempted, so a
    // UI bound to this showed "Saved" while data was being dropped.
    const state = machine.plugins.persistence.getPersistenceState();
    expect(state.lastSavedAt).toBeNull();
    expect(state.error).toBeInstanceOf(Error);
    expect(machine.plugins.persistence.inspectPersistedState()).toBeNull();
    expect(reported.length).toBeGreaterThan(0);
  });

  it("routes an async failure through onListenerError, not console", async () => {
    const reported: unknown[] = [];
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: {} },
      {
        plugins: [
          createPersistencePlugin({ key: KEY, storage: storageThatFails("async") })
        ] as const,
        onListenerError: (error) => reported.push(error)
      }
    );
    machine.controls.start();
    await flush();

    expect(reported.some((error) => (error as Error).message === "quota exceeded")).toBe(true);
  });

  it("records a synchronous failure while still letting isolation report it", async () => {
    const reported: unknown[] = [];
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: {} },
      {
        plugins: [
          createPersistencePlugin({ key: KEY, storage: storageThatFails("sync") })
        ] as const,
        onListenerError: (error) => reported.push(error)
      }
    );
    machine.controls.start();
    await flush();

    expect(machine.plugins.persistence.getPersistenceState().error).toBeInstanceOf(Error);
    expect(reported.length).toBeGreaterThan(0);
    expect(machine.getSnapshot().status).toBe("running");
  });

  it("clears the error once a write succeeds", async () => {
    let failing = true;
    const written = new Map<string, string>();
    const storage: JourneyStorage = {
      getItem: (key) => written.get(key) ?? null,
      setItem: (key, value) => {
        if (failing) return Promise.reject(new Error("down"));
        written.set(key, value);
        return Promise.resolve();
      },
      removeItem: (key) => void written.delete(key)
    };

    const machine = createLinearJourney(
      { steps: ["a", "b", "c"], context: {} },
      {
        plugins: [createPersistencePlugin({ key: KEY, storage })] as const,
        onListenerError: () => undefined
      }
    );
    machine.controls.start();
    await flush();
    expect(machine.plugins.persistence.getPersistenceState().error).toBeInstanceOf(Error);

    failing = false;
    await machine.navigate.goToNextStep();
    await flush();

    const state: PersistenceState = machine.plugins.persistence.getPersistenceState();
    expect(state.error).toBeNull();
    expect(state.lastSavedAt).not.toBeNull();
  });
});

describe("parsePersistedState validation", () => {
  it("rejects a status that is not a real lifecycle status", () => {
    const raw = JSON.stringify({
      status: "totally-made-up",
      context: {},
      timeline: ["a"],
      currentIndex: 0,
      savedAt: 1
    });

    expect(parsePersistedState(raw)).toBeNull();
  });

  it("rejects a timeline holding non-strings", () => {
    const raw = JSON.stringify({
      status: "running",
      context: {},
      timeline: ["a", 7],
      currentIndex: 0,
      savedAt: 1
    });

    expect(parsePersistedState(raw)).toBeNull();
  });

  it("rejects a non-integer currentIndex", () => {
    const raw = JSON.stringify({
      status: "running",
      context: {},
      timeline: ["a"],
      currentIndex: 1.5,
      savedAt: 1
    });

    expect(parsePersistedState(raw)).toBeNull();
  });

  it("strips prototype-poisoning keys from a restored context", () => {
    const raw =
      '{"status":"running","context":{"__proto__":{"polluted":"yes"},"keep":1},"timeline":["a"],"currentIndex":0,"savedAt":1}';

    const parsed = parsePersistedState(raw);

    expect(parsed).not.toBeNull();
    const context = parsed?.context as Record<string, unknown>;
    expect(context.keep).toBe(1);
    expect(Object.prototype.hasOwnProperty.call(context, "__proto__")).toBe(false);
    // The danger was downstream: spreading an own `__proto__` key into a fresh
    // object reassigns that object's prototype.
    const merged = { ...context };
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
  });

  it("strips them from nested context values too", () => {
    const raw =
      '{"status":"running","context":{"nested":{"__proto__":{"x":1},"ok":2}},"timeline":["a"],"currentIndex":0,"savedAt":1}';

    const parsed = parsePersistedState(raw);
    const nested = (parsed?.context as { nested: Record<string, unknown> }).nested;

    expect(nested.ok).toBe(2);
    expect(Object.prototype.hasOwnProperty.call(nested, "__proto__")).toBe(false);
  });
});
