import { describe, expect, it, vi } from "vitest";
import { createLinearJourney } from "@rxova/journey-core";
import {
  createPersistencePlugin,
  DEFAULT_SAVE_REASONS,
  normalizeDebounceMs
} from "@rxova/journey-core/plugins";
import { flush, wait } from "@rxova/journey-core/testing";
import type { JourneyStorage } from "@rxova/journey-core/plugins";

function memoryStorage(): JourneyStorage & { dump(): Map<string, string> } {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    dump: () => data
  };
}

// `debounceMs` is what used to be a separate autosave plugin; these are its
// tests, carried over to the merged one.
describe("persistence plugin — debounced writes", () => {
  it("debounces saves and reports the write status", async () => {
    const storage = memoryStorage();
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: {} },
      {
        plugins: [createPersistencePlugin({ storage, key: "auto", debounceMs: 10 })] as const,
        // The untouched state is the first assertion, and entering the initial
        // step already schedules a save.
        autoStart: false
      }
    );
    const api = machine.plugins.persistence;
    expect(api.getPersistenceState()).toEqual({
      status: "idle",
      lastSavedAt: null,
      error: null
    });

    machine.controls.start();
    await flush();
    await machine.navigate.goToNextStep();
    expect(api.getPersistenceState().status).toBe("pending");
    expect(storage.dump().size).toBe(0); // debounce window still open

    await wait(30);
    expect(api.getPersistenceState().status).toBe("saved");
    expect(api.readPersisted()).toMatchObject({ timeline: ["a", "b"], currentIndex: 1 });
  });

  it("collapses rapid changes into one write", async () => {
    const storage = memoryStorage();
    let writes = 0;
    const counting: JourneyStorage = {
      ...storage,
      setItem: (key, value) => {
        writes += 1;
        storage.setItem(key, value);
      }
    };
    const machine = createLinearJourney(
      { steps: ["a"], context: { n: 0 } },
      { plugins: [createPersistencePlugin({ storage: counting, key: "auto", debounceMs: 15 })] }
    );
    await flush();
    writes = 0;

    machine.context.update((context) => ({ n: context.n + 1 }));
    machine.context.update((context) => ({ n: context.n + 1 }));
    machine.context.update((context) => ({ n: context.n + 1 }));
    await wait(40);

    expect(writes).toBe(1);
  });

  it("writes immediately when no debounce is configured", async () => {
    const storage = memoryStorage();
    const machine = createLinearJourney(
      { steps: ["a"], context: { n: 0 } },
      { plugins: [createPersistencePlugin({ storage, key: "auto" })] as const }
    );
    await flush();

    machine.context.update(() => ({ n: 1 }));
    // No timer to wait on: the status never passes through "pending".
    expect(machine.plugins.persistence.getPersistenceState().status).toBe("saved");
    expect(storage.dump().size).toBe(1);
  });

  it("flushPersisted saves immediately; clearPersisted removes the entry", async () => {
    const storage = memoryStorage();
    const machine = createLinearJourney(
      { steps: ["a"], context: { n: 0 } },
      { plugins: [createPersistencePlugin({ storage, key: "auto", debounceMs: 50 })] as const }
    );
    await flush();
    const api = machine.plugins.persistence;

    machine.context.update(() => ({ n: 1 }));
    expect(api.getPersistenceState().status).toBe("pending");

    await api.flushPersisted();
    expect(api.getPersistenceState().status).toBe("saved");
    expect(api.readPersisted()).toMatchObject({ context: { n: 1 } });

    api.clearPersisted();
    expect(api.readPersisted()).toBeNull();
    expect(api.getPersistenceState()).toEqual({ status: "idle", lastSavedAt: null, error: null });
  });

  it("saveOn filters which observations schedule a save", async () => {
    const storage = memoryStorage();
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: { n: 0 } },
      {
        plugins: [
          createPersistencePlugin({
            storage,
            key: "auto",
            debounceMs: 5,
            saveOn: ["transition"]
          })
        ] as const
      }
    );
    await wait(20); // let the initial entry's own debounced save land
    storage.dump().clear();

    machine.context.update(() => ({ n: 1 }));
    await wait(20);
    expect(storage.dump().size).toBe(0); // context changes are not in saveOn

    await machine.navigate.goToNextStep();
    await wait(20);
    expect(storage.dump().size).toBe(1);
  });

  it("records a debounced storage failure as error state rather than throwing", async () => {
    const boom = new Error("quota exceeded");
    const reported: unknown[] = [];
    const machine = createLinearJourney(
      { steps: ["a"], context: { n: 0 } },
      {
        plugins: [
          createPersistencePlugin({
            storage: {
              getItem: () => null,
              setItem: () => {
                throw boom;
              },
              removeItem: () => undefined
            },
            key: "auto",
            debounceMs: 5
          })
        ] as const,
        onListenerError: (error) => reported.push(error)
      }
    );
    await flush();

    machine.context.update(() => ({ n: 1 }));
    await wait(20);

    const state = machine.plugins.persistence.getPersistenceState();
    expect(state.status).toBe("error");
    expect(state.error).toBe(boom);
  });

  it("dispose cancels a pending save", async () => {
    const storage = memoryStorage();
    const machine = createLinearJourney(
      { steps: ["a"], context: { n: 0 } },
      { plugins: [createPersistencePlugin({ storage, key: "auto", debounceMs: 15 })] as const }
    );
    await wait(30); // let the initial entry's own debounced save land
    storage.dump().clear();

    machine.context.update(() => ({ n: 1 }));
    machine.dispose();
    await wait(30);

    expect(storage.dump().size).toBe(0);
  });
});

describe("normalizeDebounceMs", () => {
  it("treats a missing or non-finite value as no debounce", () => {
    expect(normalizeDebounceMs(undefined)).toBe(0);
    expect(normalizeDebounceMs(Number.NaN)).toBe(0);
    expect(normalizeDebounceMs(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("clamps negatives to zero and truncates fractions", () => {
    expect(normalizeDebounceMs(-10)).toBe(0);
    expect(normalizeDebounceMs(12.9)).toBe(12);
  });
});

describe("DEFAULT_SAVE_REASONS", () => {
  it("covers every observation kind a save can be scheduled on", () => {
    expect([...DEFAULT_SAVE_REASONS].sort()).toEqual(["context", "status", "transition"]);
  });
});

// Keeps vi imported for parity with the sibling suites' setup style.
void vi;
