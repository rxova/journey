import { describe, expect, it } from "vitest";
import { createGraphJourney, createLinearJourney } from "@rxova/journey-core";
import { createPersistencePlugin } from "@rxova/journey-core/persistence";
import { flush } from "@rxova/journey-core/testing";
import type { JourneyStorage } from "@rxova/journey-core/persistence";

function memoryStorage(): JourneyStorage & { dump(): Map<string, string> } {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    dump: () => data
  };
}

const KEY = "journey";

const linearDefinition = {
  steps: ["a", "b", "c"],
  context: { n: 0 } as { n: number }
} as const;

/** Runs a persisted session to step "b" with context { n: 1 } and returns its storage. */
async function persistedLinearSession() {
  const storage = memoryStorage();
  const machine = createLinearJourney(linearDefinition, { persist: { key: KEY, storage } });
  machine.controls.start();
  await flush();
  await machine.navigate.goToNextStep();
  machine.context.update(() => ({ n: 1 }));
  return storage;
}

describe("persist option restore", () => {
  it("resumes a linear journey from the persisted record", async () => {
    const storage = await persistedLinearSession();

    const revived = createLinearJourney(linearDefinition, { persist: { key: KEY, storage } });
    expect(revived.getSnapshot().status).toBe("idle");
    expect(revived.getSnapshot().context).toEqual({ n: 1 });

    const entered: { from: string | null; to: string; direction: string }[] = [];
    revived.subscriptions.subscribeEvent("stepEnter", ({ from, to, direction }) =>
      entered.push({ from, to, direction })
    );
    revived.controls.start();
    await flush();

    const snapshot = revived.getSnapshot();
    expect(snapshot.currentStep?.id).toBe("b");
    expect(snapshot.history.timeline).toEqual(["a", "b"]);
    expect(snapshot.history.currentIndex).toBe(1);
    expect(snapshot.history.visited).toEqual({ a: true, b: true, c: false });
    expect(snapshot.currentStep?.isFirstTimeVisit).toBe(false);
    expect(entered).toEqual([{ from: null, to: "b", direction: "jump" }]);
  });

  it("resumes a graph journey and keeps navigating from the restored step", async () => {
    const storage = memoryStorage();
    const definition = {
      steps: { a: {}, b: {}, c: {} },
      transitions: {
        NEXT: [
          { from: "a", to: "b" },
          { from: "b", to: "c" }
        ]
      },
      initial: "a",
      context: { n: 0 }
    } as const;

    const machine = createGraphJourney(definition, { persist: { key: KEY, storage } });
    machine.controls.start();
    await flush();
    await machine.send("NEXT");

    const revived = createGraphJourney(definition, { persist: { key: KEY, storage } });
    revived.controls.start();
    await flush();
    expect(revived.getSnapshot().currentStep?.id).toBe("b");

    await revived.send("NEXT");
    expect(revived.getSnapshot().currentStep?.id).toBe("c");
    expect(revived.getSnapshot().history.timeline).toEqual(["a", "b", "c"]);
  });

  it("an explicit startAt wins over the persisted record", async () => {
    const storage = await persistedLinearSession();

    const revived = createLinearJourney(linearDefinition, {
      persist: { key: KEY, storage },
      startAt: "c"
    });
    revived.controls.start();
    await flush();

    const snapshot = revived.getSnapshot();
    expect(snapshot.currentStep?.id).toBe("c");
    expect(snapshot.history.timeline).toEqual(["c"]);
    expect(snapshot.context).toEqual({ n: 0 });
  });

  it("ignores records with a terminal status", async () => {
    const storage = memoryStorage();
    const machine = createLinearJourney(linearDefinition, { persist: { key: KEY, storage } });
    machine.controls.start();
    await flush();
    await machine.navigate.goToNextStep();
    machine.controls.complete();

    const revived = createLinearJourney(linearDefinition, { persist: { key: KEY, storage } });
    revived.controls.start();
    await flush();
    expect(revived.getSnapshot().currentStep?.id).toBe("a");
    expect(revived.getSnapshot().context).toEqual({ n: 0 });
  });

  it("restores a paused record as resumable", async () => {
    const storage = memoryStorage();
    const machine = createLinearJourney(linearDefinition, { persist: { key: KEY, storage } });
    machine.controls.start();
    await flush();
    await machine.navigate.goToNextStep();
    machine.controls.pause();

    const revived = createLinearJourney(linearDefinition, { persist: { key: KEY, storage } });
    revived.controls.start();
    await flush();
    expect(revived.getSnapshot().status).toBe("running");
    expect(revived.getSnapshot().currentStep?.id).toBe("b");
  });

  it("ignores records whose timeline mentions an undeclared step", async () => {
    const storage = await persistedLinearSession();

    const revived = createLinearJourney({ steps: ["a", "x"], context: { n: 0 } } as const, {
      persist: { key: KEY, storage }
    });
    revived.controls.start();
    await flush();
    expect(revived.getSnapshot().currentStep?.id).toBe("a");
    expect(revived.getSnapshot().context).toEqual({ n: 0 });
  });

  it("ignores malformed and out-of-bounds records", async () => {
    for (const raw of [
      "not json",
      JSON.stringify({ status: "running" }),
      JSON.stringify({ status: "idle", context: {}, timeline: ["a"], currentIndex: 0, savedAt: 1 }),
      JSON.stringify({
        status: "running",
        context: {},
        timeline: ["a"],
        currentIndex: 5,
        savedAt: 1
      })
    ]) {
      const storage = memoryStorage();
      storage.setItem(KEY, raw);
      const revived = createLinearJourney(linearDefinition, { persist: { key: KEY, storage } });
      revived.controls.start();
      await flush();
      expect(revived.getSnapshot().currentStep?.id).toBe("a");
    }
  });

  it("restart after a restore enters fresh", async () => {
    const storage = await persistedLinearSession();

    const revived = createLinearJourney(linearDefinition, { persist: { key: KEY, storage } });
    revived.controls.start();
    await flush();
    expect(revived.getSnapshot().currentStep?.id).toBe("b");

    revived.controls.complete();
    revived.controls.restart();
    await flush();

    const snapshot = revived.getSnapshot();
    expect(snapshot.currentStep?.id).toBe("a");
    expect(snapshot.history.timeline).toEqual(["a"]);
    expect(snapshot.context).toEqual({ n: 0 });
  });

  it("the explicit persistence plugin stays save-only", async () => {
    const storage = await persistedLinearSession();

    const revived = createLinearJourney(linearDefinition, {
      plugins: [createPersistencePlugin({ storage, key: KEY })] as const
    });
    revived.controls.start();
    await flush();
    expect(revived.getSnapshot().currentStep?.id).toBe("a");
    expect(revived.getSnapshot().context).toEqual({ n: 0 });
    expect(revived.plugins.persistence.readPersisted()?.currentIndex).toBe(0);
  });
});
