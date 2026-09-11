import { describe, expect, it, vi } from "vitest";
import { parsePersistedState } from "@rxova/journey-core/persistence";
import { createLinearJourney } from "@rxova/journey-core";
import { createPersistencePlugin } from "@rxova/journey-core/persistence";
import type { JourneyStorage, PersistenceApi } from "@rxova/journey-core/persistence";
import { flush } from "@rxova/journey-core/testing";

function memoryStorage(): JourneyStorage & { dump(): Map<string, string> } {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    dump: () => data
  };
}

async function startedWithPersistence(options: { clearOnTerminate?: boolean } = {}) {
  const storage = memoryStorage();
  const machine = createLinearJourney(
    { steps: ["a", "b"], context: { n: 0 } },
    {
      plugins: [
        createPersistencePlugin({ storage, key: "journey", now: () => 99, ...options })
      ] as const
    }
  );
  machine.controls.start();
  await flush();
  return { machine, storage };
}

describe("persistence plugin", () => {
  it("uses Date.now when no clock is provided", async () => {
    vi.spyOn(Date, "now").mockReturnValue(123);
    const storage = memoryStorage();
    const machine = createLinearJourney(
      { steps: ["a"], context: {} },
      { plugins: [createPersistencePlugin({ storage, key: "journey" })] as const }
    );
    machine.controls.start();
    await flush();

    expect(machine.plugins.persistence.readPersisted()?.savedAt).toBe(123);
    vi.restoreAllMocks();
  });

  it("persists the state slice on transitions, status, and context changes", async () => {
    const { machine } = await startedWithPersistence();
    await machine.navigate.goToNextStep();
    machine.context.update((c) => ({ n: c.n + 1 }));

    const persisted = machine.plugins.persistence.readPersisted();
    expect(persisted).toEqual({
      status: "running",
      context: { n: 1 },
      timeline: ["a", "b"],
      currentIndex: 1,
      savedAt: 99
    });
    expect(machine.plugins.persistence.inspectPersistedState()).toEqual(persisted);
    expect(machine.getSnapshot().plugins.persistence).toEqual({ lastSavedAt: 99, error: null });
  });

  it("clearPersisted removes the entry", async () => {
    const { machine, storage } = await startedWithPersistence();
    machine.plugins.persistence.clearPersisted();
    expect(storage.dump().size).toBe(0);
    expect(machine.plugins.persistence.readPersisted()).toBeNull();
  });

  it("clearOnTerminate removes the entry when the journey terminates", async () => {
    const { machine, storage } = await startedWithPersistence({ clearOnTerminate: true });
    await machine.navigate.goToNextStep();
    expect(storage.dump().size).toBe(1);
    machine.controls.terminate();
    expect(storage.dump().size).toBe(0);
  });

  it("readPersisted returns null for malformed payloads", async () => {
    const { machine, storage } = await startedWithPersistence();
    storage.dump().set("journey", "{not json");
    expect(machine.plugins.persistence.readPersisted()).toBeNull();
    storage.dump().set("journey", JSON.stringify({ foreign: true }));
    expect(machine.plugins.persistence.readPersisted()).toBeNull();
  });
});

describe("parsePersistedState", () => {
  it("rejects non-object and incomplete payloads", () => {
    expect(parsePersistedState("42")).toBeNull();
    expect(parsePersistedState("null")).toBeNull();
    expect(parsePersistedState(JSON.stringify({ status: "running" }))).toBeNull();
  });
});

describe("terminate without clearOnTerminate", () => {
  it("keeps the entry and persists the terminated status", async () => {
    const { machine } = await startedWithPersistence();
    machine.controls.terminate();
    expect(machine.plugins.persistence.readPersisted()).toMatchObject({ status: "terminated" });
  });
});

describe("persist creation option", () => {
  it("expands into the persistence plugin and writes under the key", async () => {
    const storage = memoryStorage();
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: { n: 0 } },
      { autoStart: true, persist: { key: "wizard", storage } }
    );
    await flush();
    await machine.navigate.goToNextStep();

    const state = parsePersistedState(storage.getItem("wizard"));
    expect(state?.timeline).toEqual(["a", "b"]);
    // The `persist` option registers the persistence plugin at runtime, but it
    // is not reflected in TPlugins, so the API is not statically reachable —
    // pass `createPersistencePlugin` explicitly when you need it typed.
    const persistence = (machine.plugins as Record<string, unknown>).persistence as
      | PersistenceApi
      | undefined;
    expect(persistence?.readPersisted()?.currentIndex).toBe(1);
  });

  it("defaults storage to globalThis.localStorage", async () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    try {
      const machine = createLinearJourney(
        { steps: ["a", "b"], context: {} },
        { autoStart: true, persist: { key: "wizard" } }
      );
      await flush();
      await machine.navigate.goToNextStep();
      expect(parsePersistedState(storage.getItem("wizard"))?.timeline).toEqual(["a", "b"]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("throws at creation when no storage is available", () => {
    vi.stubGlobal("localStorage", undefined);
    try {
      expect(() =>
        createLinearJourney({ steps: ["a"], context: {} }, { persist: { key: "wizard" } })
      ).toThrow(/persist\.storage is required/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("combined with an explicit persistence plugin fails as a duplicate name", () => {
    const storage = memoryStorage();
    expect(() =>
      createLinearJourney(
        { steps: ["a"], context: {} },
        {
          persist: { key: "wizard", storage },
          plugins: [createPersistencePlugin({ key: "other", storage })]
        }
      )
    ).toThrow(/duplicate plugin name "persistence"/);
  });
});
