import { describe, expect, it, vi } from "vitest";

import { createFlowMachine, type FlowFlow, type FlowStorage } from "@/src/core";
import { createPersistenceController } from "@/src/core/persistence";

type StepId = "start" | "details" | "review";
type Event = "next";
type Ctx = {
  count: number;
};

const createFlow = (): FlowFlow<Ctx, StepId, Event> => ({
  initial: "start",
  context: { count: 0 },
  steps: {
    start: {},
    details: {},
    review: {}
  },
  transitions: [
    { from: "start", event: "next", to: "details" },
    { from: "details", event: "next", to: "review" }
  ]
});

const createMemoryStorage = (seed: Record<string, string> = {}): FlowStorage => {
  const store = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    }
  };
};

const withPatchedLocalStorage = async (
  value: Partial<FlowStorage> | undefined,
  run: () => Promise<void> | void
) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value
  });
  try {
    await run();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "localStorage", descriptor);
    } else {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  }
};

describe("persistence", () => {
  it("hydrates snapshot from persisted state", () => {
    const storage = createMemoryStorage({
      flow: JSON.stringify({
        version: 1,
        snapshot: {
          current: "details",
          context: { count: 7 },
          history: ["start"],
          terminal: null
        }
      })
    });

    const machine = createFlowMachine(createFlow(), {
      persistence: {
        key: "flow",
        storage
      }
    });

    expect(machine.getSnapshot().current).toBe("details");
    expect(machine.getSnapshot().history).toEqual(["start"]);
    expect(machine.getSnapshot().context.count).toBe(7);
  });

  it("persists on send and updateContext", async () => {
    const storage = createMemoryStorage();
    const machine = createFlowMachine(createFlow(), {
      persistence: {
        key: "flow",
        storage
      }
    });

    await machine.send({ type: "next" });
    machine.updateContext((ctx) => ({ ...ctx, count: ctx.count + 2 }));

    const raw = storage.getItem("flow");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as {
      version: number;
      snapshot: { current: StepId; context: Ctx; history: StepId[] };
    };

    expect(parsed.version).toBe(1);
    expect(parsed.snapshot.current).toBe("details");
    expect(parsed.snapshot.context.count).toBe(2);
    expect(parsed.snapshot.history).toEqual(["start"]);
  });

  it("clears persisted state on reset by default", async () => {
    const storage = createMemoryStorage();
    const machine = createFlowMachine(createFlow(), {
      persistence: {
        key: "flow",
        storage
      }
    });

    await machine.send({ type: "next" });
    expect(storage.getItem("flow")).not.toBeNull();

    machine.reset();

    expect(storage.getItem("flow")).toBeNull();
  });

  it("persists reset state when clearOnReset is false", async () => {
    const storage = createMemoryStorage();
    const machine = createFlowMachine(createFlow(), {
      persistence: {
        key: "flow",
        storage,
        clearOnReset: false
      }
    });

    await machine.send({ type: "next" });
    machine.reset();

    const raw = storage.getItem("flow");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as {
      snapshot: { current: StepId; history: StepId[]; context: Ctx };
    };

    expect(parsed.snapshot.current).toBe("start");
    expect(parsed.snapshot.history).toEqual([]);
    expect(parsed.snapshot.context.count).toBe(0);
  });

  it("falls back to initial snapshot when persisted step is unknown", () => {
    const storage = createMemoryStorage({
      flow: JSON.stringify({
        version: 1,
        snapshot: {
          current: "missing",
          context: { count: 99 },
          history: ["start"],
          terminal: null
        }
      })
    });

    const machine = createFlowMachine(createFlow(), {
      persistence: {
        key: "flow",
        storage
      }
    });

    expect(machine.getSnapshot().current).toBe("start");
    expect(machine.getSnapshot().context.count).toBe(0);
  });

  it("migrates mismatched persisted versions", () => {
    const storage = createMemoryStorage({
      flow: JSON.stringify({
        version: 1,
        snapshot: {
          current: "start",
          context: { oldCount: 4 },
          history: [],
          terminal: null
        }
      })
    });

    const machine = createFlowMachine(createFlow(), {
      persistence: {
        key: "flow",
        storage,
        version: 2,
        migrate: (value) => {
          const snapshot = value as { context?: { oldCount?: number } };
          return {
            current: "details",
            context: { count: snapshot.context?.oldCount ?? 0 },
            history: ["start"],
            terminal: null
          };
        }
      }
    });

    expect(machine.getSnapshot().current).toBe("details");
    expect(machine.getSnapshot().context.count).toBe(4);

    const rewritten = JSON.parse(storage.getItem("flow") as string) as { version: number };
    expect(rewritten.version).toBe(2);
  });

  it("reports deserialize errors through onError and continues", () => {
    const storage = createMemoryStorage({
      flow: "not-json"
    });
    const onError = vi.fn();

    const machine = createFlowMachine(createFlow(), {
      persistence: {
        key: "flow",
        storage,
        onError
      }
    });

    expect(machine.getSnapshot().current).toBe("start");
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("uses global localStorage fallback when storage is omitted", async () => {
    const flow = createFlow();
    const setItem = vi.fn();
    const getItem = vi.fn(() => null);
    const removeItem = vi.fn();

    await withPatchedLocalStorage({ getItem, setItem, removeItem }, async () => {
      const machine = createFlowMachine(flow, {
        persistence: {
          key: "flow"
        }
      });

      await machine.send({ type: "next" });
      expect(setItem).toHaveBeenCalledTimes(1);
    });
  });

  it("disables persistence when no valid storage is available", async () => {
    const flow = createFlow();
    await withPatchedLocalStorage(undefined, async () => {
      const machine = createFlowMachine(flow, {
        persistence: {
          key: "flow"
        }
      });

      await machine.send({ type: "next" });
      expect(machine.getSnapshot().current).toBe("details");
    });
  });

  it("handles non-object and non-version persisted values", () => {
    const steps: Record<StepId, unknown> = { start: {}, details: {}, review: {} };
    const baseArgs = {
      initial: "start" as StepId,
      context: { count: 0 },
      steps
    };

    const nonObjectStorage = createMemoryStorage({
      flow: JSON.stringify("hello")
    });
    const c1 = createPersistenceController({
      ...baseArgs,
      options: {
        persistence: { key: "flow", storage: nonObjectStorage }
      }
    });
    expect(c1.hydrateSnapshot().current).toBe("start");

    const nonVersionStorage = createMemoryStorage({
      flow: JSON.stringify({ version: "1", snapshot: {} })
    });
    const c2 = createPersistenceController({
      ...baseArgs,
      options: {
        persistence: { key: "flow", storage: nonVersionStorage }
      }
    });
    expect(c2.hydrateSnapshot().current).toBe("start");
  });

  it("filters invalid history entries and falls back context/terminal on hydrate", () => {
    const storage = createMemoryStorage({
      flow: JSON.stringify({
        version: 1,
        snapshot: {
          current: "details",
          history: ["start", "missing", 42],
          terminal: "BAD"
        }
      })
    });

    const controller = createPersistenceController({
      initial: "start" as StepId,
      context: { count: 9 },
      steps: { start: {}, details: {}, review: {} } as Record<StepId, unknown>,
      options: {
        persistence: { key: "flow", storage }
      }
    });

    const snapshot = controller.hydrateSnapshot();
    expect(snapshot.current).toBe("details");
    expect(snapshot.history).toEqual(["start"]);
    expect(snapshot.context).toEqual({ count: 9 });
    expect(snapshot.terminal).toBeNull();
  });

  it("uses empty history when persisted history is not an array", () => {
    const storage = createMemoryStorage({
      flow: JSON.stringify({
        version: 1,
        snapshot: {
          current: "details",
          history: "invalid",
          context: { count: 2 },
          terminal: null
        }
      })
    });
    const controller = createPersistenceController({
      initial: "start" as StepId,
      context: { count: 0 },
      steps: { start: {}, details: {}, review: {} } as Record<StepId, unknown>,
      options: {
        persistence: { key: "flow", storage }
      }
    });

    expect(controller.hydrateSnapshot().history).toEqual([]);
  });

  it("hydrates terminal when persisted terminal is valid", () => {
    const storage = createMemoryStorage({
      flow: JSON.stringify({
        version: 1,
        snapshot: {
          current: "details",
          history: [],
          context: { count: 2 },
          terminal: "COMPLETE"
        }
      })
    });
    const controller = createPersistenceController({
      initial: "start" as StepId,
      context: { count: 0 },
      steps: { start: {}, details: {}, review: {} } as Record<StepId, unknown>,
      options: {
        persistence: { key: "flow", storage }
      }
    });

    const snapshot = controller.hydrateSnapshot();
    expect(snapshot.terminal).toBe("COMPLETE");
    expect(snapshot.isDone).toBe(true);
  });

  it("ignores non-object snapshots on hydrate", () => {
    const storage = createMemoryStorage({
      flow: JSON.stringify({
        version: 1,
        snapshot: 5
      })
    });
    const controller = createPersistenceController({
      initial: "start" as StepId,
      context: { count: 0 },
      steps: { start: {}, details: {}, review: {} } as Record<StepId, unknown>,
      options: {
        persistence: { key: "flow", storage }
      }
    });

    expect(controller.hydrateSnapshot().current).toBe("start");
  });

  it("reports errors when persist/remove throw", () => {
    const erroringStorage: FlowStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("set-failed");
      },
      removeItem: () => {
        throw new Error("remove-failed");
      }
    };
    const onError = vi.fn();

    const controller = createPersistenceController({
      initial: "start" as StepId,
      context: { count: 0 },
      steps: { start: {}, details: {}, review: {} } as Record<StepId, unknown>,
      options: {
        persistence: {
          key: "flow",
          storage: erroringStorage,
          onError
        }
      }
    });

    controller.persistSnapshot({
      current: "start",
      context: { count: 0 },
      history: [],
      visited: ["start"],
      terminal: null,
      isDone: false
    });
    controller.removePersistedSnapshot();

    expect(onError).toHaveBeenCalledTimes(2);
  });
});
