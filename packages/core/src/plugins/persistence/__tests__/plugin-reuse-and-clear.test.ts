import { afterEach, describe, expect, it, vi } from "vitest";
import { createLinearJourney } from "@rxova/journey-core";
import { createPersistencePlugin } from "@rxova/journey-core/persistence";
import { createAutosavePlugin } from "@rxova/journey-core/autosave";
import { flush } from "@rxova/journey-core/testing";
import type { JourneyStorage } from "@rxova/journey-core/persistence";

const KEY = "journey";

function memoryStorage(): JourneyStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key)
  };
}

function storageWhoseRemoveThrows(error: unknown): JourneyStorage {
  return {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => {
      throw error;
    }
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as { __DEV__?: boolean }).__DEV__;
});

/** NODE_ENV=test suppresses dev warnings; `__DEV__` is how the suite opts in. */
const enableDevWarnings = () => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
};

/**
 * Plugin state is scoped per setup(), but `options` is not — one instance across
 * two machines means both write the same storage key and silently overwrite
 * each other.
 */
describe("a plugin instance shared across machines", () => {
  it("warns for persistence from the second machine on", () => {
    enableDevWarnings();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const plugin = createPersistencePlugin({ key: KEY, storage: memoryStorage() });

    createLinearJourney({ steps: ["a"], context: {} }, { plugins: [plugin] as const });
    expect(warn).not.toHaveBeenCalled();

    createLinearJourney({ steps: ["a"], context: {} }, { plugins: [plugin] as const });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain(KEY);
  });

  it("warns for autosave from the second machine on", () => {
    enableDevWarnings();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const plugin = createAutosavePlugin({ key: KEY, storage: memoryStorage() });

    createLinearJourney({ steps: ["a"], context: {} }, { plugins: [plugin] as const });
    createLinearJourney({ steps: ["a"], context: {} }, { plugins: [plugin] as const });

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("does not warn when each machine gets its own instance", () => {
    enableDevWarnings();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const storage = memoryStorage();

    createLinearJourney(
      { steps: ["a"], context: {} },
      { plugins: [createPersistencePlugin({ key: KEY, storage })] as const }
    );
    createLinearJourney(
      { steps: ["a"], context: {} },
      { plugins: [createPersistencePlugin({ key: KEY, storage })] as const }
    );

    expect(warn).not.toHaveBeenCalled();
  });
});

describe("clear APIs contain storage failures", () => {
  it("clearPersisted records the failure instead of throwing at the caller", async () => {
    const boom = new Error("remove blocked");
    const reported: unknown[] = [];
    const machine = createLinearJourney(
      { steps: ["a"], context: {} },
      {
        plugins: [
          createPersistencePlugin({ key: KEY, storage: storageWhoseRemoveThrows(boom) })
        ] as const,
        onListenerError: (error) => reported.push(error)
      }
    );
    machine.controls.start();
    await flush();

    expect(() => machine.plugins.persistence.clearPersisted()).not.toThrow();
    expect(machine.plugins.persistence.getPersistenceState().error).toBe(boom);
    expect(reported).toContain(boom);
  });

  it("clearAutosave records the failure instead of throwing at the caller", async () => {
    const boom = new Error("remove blocked");
    const machine = createLinearJourney(
      { steps: ["a"], context: {} },
      {
        plugins: [
          createAutosavePlugin({ key: KEY, storage: storageWhoseRemoveThrows(boom) })
        ] as const
      }
    );
    machine.controls.start();
    await flush();

    expect(() => machine.plugins.autosave.clearAutosave()).not.toThrow();
    const state = machine.plugins.autosave.getAutosaveState();
    expect(state.status).toBe("error");
    expect(state.error).toBe(boom);
  });

  it("clearOnTerminate still removes the entry on a healthy adapter", async () => {
    const storage = memoryStorage();
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: {} },
      {
        plugins: [createPersistencePlugin({ key: KEY, storage, clearOnTerminate: true })] as const
      }
    );
    machine.controls.start();
    await flush();
    expect(storage.getItem(KEY)).not.toBeNull();

    machine.controls.terminate();
    await flush();

    expect(storage.getItem(KEY)).toBeNull();
  });
});
