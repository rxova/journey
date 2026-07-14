import { describe, expect, it } from "vitest";
import { parsePersistedState } from "@rxova/journey-core/persistence";
import { createLinearJourney } from "@rxova/journey-core";
import { createPersistencePlugin } from "@rxova/journey-core/persistence";
import type { JourneyStorage } from "@rxova/journey-core/persistence";
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
    expect(machine.getSnapshot().plugins.persistence).toEqual({ lastSavedAt: 99 });
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
