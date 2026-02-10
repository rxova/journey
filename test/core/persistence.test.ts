import { describe, expect, it, vi } from "vitest";

import {
  createJourneyMachine,
  JOURNEY_STATUS,
  type JourneyDefinition,
  type JourneyStorage
} from "@/src/core";
import { createPersistenceController } from "@/src/core/persistence";

type StepId = "start" | "details" | "review";
type Event = "next";
type Ctx = {
  count: number;
};

const createJourney = (): JourneyDefinition<Ctx, StepId, Event> => ({
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

const createMemoryStorage = (seed: Record<string, string> = {}): JourneyStorage => {
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
const asyncState = () => ({
  isLoading: false,
  byStep: {
    start: { phase: "idle" as const, eventType: null, transitionId: null, error: null },
    details: { phase: "idle" as const, eventType: null, transitionId: null, error: null },
    review: { phase: "idle" as const, eventType: null, transitionId: null, error: null }
  }
});

const withPatchedLocalStorage = async (
  value: Partial<JourneyStorage> | undefined,
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
      journey: JSON.stringify({
        version: 1,
        snapshot: {
          current: "details",
          context: { count: 7 },
          history: ["start"],
          status: JOURNEY_STATUS.RUNNING
        }
      })
    });

    const machine = createJourneyMachine(createJourney(), {
      persistence: {
        key: "journey",
        storage
      }
    });

    expect(machine.getSnapshot().current).toBe("details");
    expect(machine.getSnapshot().history).toEqual(["start"]);
    expect(machine.getSnapshot().context.count).toBe(7);
  });

  it("persists on send and updateContext", async () => {
    const storage = createMemoryStorage();
    const machine = createJourneyMachine(createJourney(), {
      persistence: {
        key: "journey",
        storage
      }
    });

    await machine.send({ type: "next" });
    machine.updateContext((ctx) => ({ ...ctx, count: ctx.count + 2 }));

    const raw = storage.getItem("journey");
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
    const machine = createJourneyMachine(createJourney(), {
      persistence: {
        key: "journey",
        storage
      }
    });

    await machine.send({ type: "next" });
    expect(storage.getItem("journey")).not.toBeNull();

    machine.reset();

    expect(storage.getItem("journey")).toBeNull();
  });

  it("persists reset state when clearOnReset is false", async () => {
    const storage = createMemoryStorage();
    const machine = createJourneyMachine(createJourney(), {
      persistence: {
        key: "journey",
        storage,
        clearOnReset: false
      }
    });

    await machine.send({ type: "next" });
    machine.reset();

    const raw = storage.getItem("journey");
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
      journey: JSON.stringify({
        version: 1,
        snapshot: {
          current: "missing",
          context: { count: 99 },
          history: ["start"],
          status: JOURNEY_STATUS.RUNNING
        }
      })
    });

    const machine = createJourneyMachine(createJourney(), {
      persistence: {
        key: "journey",
        storage
      }
    });

    expect(machine.getSnapshot().current).toBe("start");
    expect(machine.getSnapshot().context.count).toBe(0);
  });

  it("migrates mismatched persisted versions", () => {
    const storage = createMemoryStorage({
      journey: JSON.stringify({
        version: 1,
        snapshot: {
          current: "start",
          context: { oldCount: 4 },
          history: [],
          status: JOURNEY_STATUS.RUNNING
        }
      })
    });

    const machine = createJourneyMachine(createJourney(), {
      persistence: {
        key: "journey",
        storage,
        version: 2,
        migrate: (value) => {
          const snapshot = value as { context?: { oldCount?: number } };
          return {
            current: "details",
            context: { count: snapshot.context?.oldCount ?? 0 },
            history: ["start"],
            status: JOURNEY_STATUS.RUNNING
          };
        }
      }
    });

    expect(machine.getSnapshot().current).toBe("details");
    expect(machine.getSnapshot().context.count).toBe(4);

    const rewritten = JSON.parse(storage.getItem("journey") as string) as { version: number };
    expect(rewritten.version).toBe(2);
  });

  it("reports deserialize errors through onError and continues", () => {
    const storage = createMemoryStorage({
      journey: "not-json"
    });
    const onError = vi.fn();

    const machine = createJourneyMachine(createJourney(), {
      persistence: {
        key: "journey",
        storage,
        onError
      }
    });

    expect(machine.getSnapshot().current).toBe("start");
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("uses global localStorage fallback when storage is omitted", async () => {
    const journey = createJourney();
    const setItem = vi.fn();
    const getItem = vi.fn(() => null);
    const removeItem = vi.fn();

    await withPatchedLocalStorage({ getItem, setItem, removeItem }, async () => {
      const machine = createJourneyMachine(journey, {
        persistence: {
          key: "journey"
        }
      });

      await machine.send({ type: "next" });
      expect(setItem).toHaveBeenCalledTimes(1);
    });
  });

  it("disables persistence when no valid storage is available", async () => {
    const journey = createJourney();
    await withPatchedLocalStorage(undefined, async () => {
      const machine = createJourneyMachine(journey, {
        persistence: {
          key: "journey"
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
      journey: JSON.stringify("hello")
    });
    const c1 = createPersistenceController({
      ...baseArgs,
      options: {
        persistence: { key: "journey", storage: nonObjectStorage }
      }
    });
    expect(c1.hydrateSnapshot().current).toBe("start");

    const nonVersionStorage = createMemoryStorage({
      journey: JSON.stringify({ version: "1", snapshot: {} })
    });
    const c2 = createPersistenceController({
      ...baseArgs,
      options: {
        persistence: { key: "journey", storage: nonVersionStorage }
      }
    });
    expect(c2.hydrateSnapshot().current).toBe("start");
  });

  it("filters invalid history entries and falls back context/status on hydrate", () => {
    const storage = createMemoryStorage({
      journey: JSON.stringify({
        version: 1,
        snapshot: {
          current: "details",
          history: ["start", "missing", 42],
          status: "BAD"
        }
      })
    });

    const controller = createPersistenceController({
      initial: "start" as StepId,
      context: { count: 9 },
      steps: { start: {}, details: {}, review: {} } as Record<StepId, unknown>,
      options: {
        persistence: { key: "journey", storage }
      }
    });

    const snapshot = controller.hydrateSnapshot();
    expect(snapshot.current).toBe("details");
    expect(snapshot.history).toEqual(["start"]);
    expect(snapshot.context).toEqual({ count: 9 });
    expect(snapshot.status).toBe(JOURNEY_STATUS.RUNNING);
  });

  it("uses empty history when persisted history is not an array", () => {
    const storage = createMemoryStorage({
      journey: JSON.stringify({
        version: 1,
        snapshot: {
          current: "details",
          history: "invalid",
          context: { count: 2 },
          status: JOURNEY_STATUS.RUNNING
        }
      })
    });
    const controller = createPersistenceController({
      initial: "start" as StepId,
      context: { count: 0 },
      steps: { start: {}, details: {}, review: {} } as Record<StepId, unknown>,
      options: {
        persistence: { key: "journey", storage }
      }
    });

    expect(controller.hydrateSnapshot().history).toEqual([]);
  });

  it("hydrates status when persisted status is valid", () => {
    const storage = createMemoryStorage({
      journey: JSON.stringify({
        version: 1,
        snapshot: {
          current: "details",
          history: [],
          context: { count: 2 },
          status: JOURNEY_STATUS.COMPLETE
        }
      })
    });
    const controller = createPersistenceController({
      initial: "start" as StepId,
      context: { count: 0 },
      steps: { start: {}, details: {}, review: {} } as Record<StepId, unknown>,
      options: {
        persistence: { key: "journey", storage }
      }
    });

    const snapshot = controller.hydrateSnapshot();
    expect(snapshot.status).toBe(JOURNEY_STATUS.COMPLETE);
  });

  it("ignores non-object snapshots on hydrate", () => {
    const storage = createMemoryStorage({
      journey: JSON.stringify({
        version: 1,
        snapshot: 5
      })
    });
    const controller = createPersistenceController({
      initial: "start" as StepId,
      context: { count: 0 },
      steps: { start: {}, details: {}, review: {} } as Record<StepId, unknown>,
      options: {
        persistence: { key: "journey", storage }
      }
    });

    expect(controller.hydrateSnapshot().current).toBe("start");
  });

  it("reports errors when persist/remove throw", () => {
    const erroringStorage: JourneyStorage = {
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
          key: "journey",
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
      status: JOURNEY_STATUS.RUNNING,
      async: asyncState()
    });
    controller.removePersistedSnapshot();

    expect(onError).toHaveBeenCalledTimes(2);
  });
});
