import { describe, expect, it } from "vitest";
import { normalizeDebounceMs } from "@rxova/journey-core/autosave";
import { createLinearJourney } from "@rxova/journey-core";
import { createAutosavePlugin } from "@rxova/journey-core/autosave";
import type { JourneyStorage } from "@rxova/journey-core/persistence";
import { flush, wait } from "@rxova/journey-core/testing";

function memoryStorage(): JourneyStorage & { dump(): Map<string, string> } {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    dump: () => data
  };
}

describe("autosave plugin", () => {
  it("debounces saves and reports autosave state", async () => {
    const storage = memoryStorage();
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: {} },
      { plugins: [createAutosavePlugin({ storage, key: "auto", debounceMs: 10 })] as const }
    );
    const api = machine.plugins.autosave;
    expect(api.getAutosaveState()).toEqual({ status: "idle", lastSavedAt: null, error: null });

    machine.controls.start();
    await flush();
    await machine.navigate.goToNextStep();
    expect(api.getAutosaveState().status).toBe("pending");
    expect(storage.dump().size).toBe(0); // debounce window still open

    await wait(30);
    expect(api.getAutosaveState().status).toBe("saved");
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
      { steps: ["a", "b", "c", "d"], context: {} },
      {
        plugins: [createAutosavePlugin({ storage: counting, key: "auto", debounceMs: 20 })] as const
      }
    );
    machine.controls.start();
    await flush();
    await machine.navigate.goToNextStep();
    await machine.navigate.goToNextStep();
    await machine.navigate.goToNextStep();
    await wait(40);

    expect(writes).toBe(1);
    expect(machine.plugins.autosave.readPersisted()).toMatchObject({ currentIndex: 3 });
  });

  it("flushAutosave saves immediately; clearAutosave removes the entry", async () => {
    const storage = memoryStorage();
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: {} },
      { plugins: [createAutosavePlugin({ storage, key: "auto", debounceMs: 5000 })] as const }
    );
    machine.controls.start();
    await flush();

    await machine.plugins.autosave.flushAutosave();
    expect(machine.plugins.autosave.getAutosaveState().status).toBe("saved");
    expect(storage.dump().size).toBe(1);

    machine.plugins.autosave.clearAutosave();
    expect(storage.dump().size).toBe(0);
    expect(machine.plugins.autosave.getAutosaveState()).toEqual({
      status: "idle",
      lastSavedAt: null,
      error: null
    });
  });

  it("saveOn filters which observations schedule a save", async () => {
    const storage = memoryStorage();
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: { n: 0 } },
      {
        plugins: [
          createAutosavePlugin({ storage, key: "auto", debounceMs: 5, saveOn: ["context"] })
        ] as const
      }
    );
    machine.controls.start();
    await flush();
    await machine.navigate.goToNextStep();
    await wait(20);
    expect(storage.dump().size).toBe(0); // transitions don't schedule

    machine.context.update((c) => ({ n: c.n + 1 }));
    await wait(20);
    expect(storage.dump().size).toBe(1);
  });

  it("records storage failures as error state", async () => {
    const machine = createLinearJourney(
      { steps: ["a"], context: {} },
      {
        plugins: [
          createAutosavePlugin({
            storage: {
              getItem: () => null,
              setItem: () => {
                throw new Error("quota exceeded");
              },
              removeItem: () => undefined
            },
            key: "auto",
            debounceMs: 0
          })
        ] as const
      }
    );
    machine.controls.start();
    await flush();
    await machine.plugins.autosave.flushAutosave();

    const state = machine.plugins.autosave.getAutosaveState();
    expect(state.status).toBe("error");
    expect(String((state.error as Error).message)).toContain("quota");
  });

  it("dispose cancels a pending save", async () => {
    const storage = memoryStorage();
    const machine = createLinearJourney(
      { steps: ["a"], context: {} },
      { plugins: [createAutosavePlugin({ storage, key: "auto", debounceMs: 10 })] as const }
    );
    machine.controls.start();
    await flush();
    expect(machine.plugins.autosave.getAutosaveState().status).toBe("pending");
    machine.dispose();
    await wait(30);
    expect(storage.dump().size).toBe(0);
  });
});

describe("normalizeDebounceMs", () => {
  it("falls back for non-finite values and clamps negatives", () => {
    expect(normalizeDebounceMs(Number.NaN)).toBe(300);
    expect(normalizeDebounceMs(undefined)).toBe(300);
    expect(normalizeDebounceMs(Number.POSITIVE_INFINITY)).toBe(300);
    expect(normalizeDebounceMs(-5)).toBe(0);
    expect(normalizeDebounceMs(12.7)).toBe(12);
  });
});
