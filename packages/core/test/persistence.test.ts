import { describe, expect, it, vi } from "vitest";

import {
  createJourneyMachine,
  createPersistenceController,
  type JourneyDefinition,
  type JourneyStorage
} from "@rxova/journey-core";

type StepId = "start" | "details" | "review";
type Event = "goToNextStep" | "back";
type Context = { count: number };
type Meta = { title: string };

const createStorage = () => {
  const store = new Map<string, string>();

  const storage: JourneyStorage = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    })
  };

  return { storage, store };
};

const createJourney = (): JourneyDefinition<
  Context,
  StepId,
  Event,
  Record<never, never>,
  Meta
> => ({
  initial: "start",
  context: { count: 0 },
  steps: {
    start: { meta: { title: "Start" } },
    details: { meta: { title: "Details" } },
    review: { meta: { title: "Review" } }
  },
  transitions: [
    { from: "start", event: "goToNextStep", to: "details" },
    { from: "details", event: "goToNextStep", to: "review" }
  ]
});

describe("persistence", () => {
  it("persists and hydrates timeline/index snapshots", async () => {
    const { storage, store } = createStorage();
    const key = "journey:timeline";

    const machineA = createJourneyMachine(createJourney(), {
      persistence: { key, storage, clearOnReset: false }
    });

    await machineA.send({ type: "goToNextStep" });
    await machineA.send({ type: "goToNextStep" });
    await machineA.goToPreviousStep();

    const raw = store.get(key);
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.snapshot.history.timeline).toEqual(["start", "details", "review"]);
    expect(parsed.snapshot.history.index).toBe(1);
    expect(parsed.snapshot.currentStepId).toBe("details");
    expect(parsed.snapshot.stepMeta.details).toEqual({ title: "Details" });

    const machineB = createJourneyMachine(createJourney(), {
      persistence: { key, storage, clearOnReset: false }
    });

    const hydrated = machineB.getSnapshot();
    expect(hydrated.history.timeline).toEqual(["start", "details", "review"]);
    expect(hydrated.history.index).toBe(1);
    expect(hydrated.currentStepId).toBe("details");
    expect(hydrated.stepMeta.review).toEqual({ title: "Review" });
  });

  it("coerces malformed persisted data and rewrites it", () => {
    const { storage, store } = createStorage();
    const key = "journey:coerce";

    store.set(
      key,
      JSON.stringify({
        version: 1,
        snapshot: {
          currentStepId: "details",
          timeline: ["missing", "details"],
          index: 99,
          context: { count: 4 },
          status: "running",
          visited: [],
          stepMeta: { start: { title: "Start" } }
        }
      })
    );

    const machine = createJourneyMachine(createJourney(), {
      persistence: { key, storage, clearOnReset: false }
    });

    const snapshot = machine.getSnapshot();
    expect(snapshot.history.timeline).toEqual(["details"]);
    expect(snapshot.history.index).toBe(0);
    expect(snapshot.currentStepId).toBe("details");
    expect(snapshot.stepMeta.review).toEqual({ title: "Review" });

    const rewritten = JSON.parse(store.get(key) ?? "{}");
    expect(rewritten.snapshot.history.timeline).toEqual(["details"]);
    expect(rewritten.snapshot.history.index).toBe(0);
  });

  it("coerces empty timeline using current and rewrites persisted snapshot", () => {
    const { storage, store } = createStorage();
    const key = "journey:empty-timeline";

    store.set(
      key,
      JSON.stringify({
        version: 1,
        snapshot: {
          currentStepId: "details",
          timeline: [],
          index: 0,
          context: { count: 2 },
          status: "running",
          visited: { start: true, details: true, review: false },
          stepMeta: {
            start: { title: "Start" },
            details: { title: "Details" },
            review: { title: "Review" }
          }
        }
      })
    );

    const machine = createJourneyMachine(createJourney(), {
      persistence: { key, storage, clearOnReset: false }
    });

    expect(machine.getSnapshot().history.timeline).toEqual(["details"]);
    expect(machine.getSnapshot().currentStepId).toBe("details");

    const rewritten = JSON.parse(store.get(key) ?? "{}");
    expect(rewritten.snapshot.history.timeline).toEqual(["details"]);
  });

  it("supports migrate for older persisted versions", () => {
    const { storage, store } = createStorage();
    const key = "journey:migrate";

    store.set(
      key,
      JSON.stringify({
        version: 0,
        snapshot: {
          currentStepId: "start",
          legacy: true
        }
      })
    );

    const machine = createJourneyMachine(createJourney(), {
      persistence: {
        key,
        storage,
        version: 2,
        clearOnReset: false,
        migrate: (_value, persistedVersion) => ({
          currentStepId: "review",
          history: {
            timeline: ["start", "details", "review"],
            index: 2
          },
          context: { count: persistedVersion },
          status: "running",
          visited: {
            start: true,
            details: true,
            review: true
          },
          stepMeta: {
            start: { title: "Start" },
            details: { title: "Details" },
            review: { title: "Review" }
          }
        })
      }
    });

    const snapshot = machine.getSnapshot();
    expect(snapshot.currentStepId).toBe("review");
    expect(snapshot.context.count).toBe(0);
    expect(snapshot.history.timeline).toEqual(["start", "details", "review"]);
  });

  it("uses fallback context when persisted snapshot omits context", () => {
    const { storage, store } = createStorage();
    const key = "journey:missing-context";

    store.set(
      key,
      JSON.stringify({
        version: 1,
        snapshot: {
          currentStepId: "details",
          timeline: ["start", "details"],
          index: 1,
          status: "running",
          visited: { start: true, details: true, review: false },
          stepMeta: {
            start: { title: "Start" },
            details: { title: "Details" },
            review: { title: "Review" }
          }
        }
      })
    );

    const machine = createJourneyMachine(createJourney(), {
      persistence: { key, storage, clearOnReset: false }
    });

    expect(machine.getSnapshot().context).toEqual({ count: 0 });
  });

  it("falls back to initial snapshot when migrate result cannot be coerced", () => {
    const { storage, store } = createStorage();
    const key = "journey:migrate-invalid";

    store.set(
      key,
      JSON.stringify({
        version: 0,
        snapshot: {
          currentStepId: "start",
          legacy: true
        }
      })
    );

    const machine = createJourneyMachine(createJourney(), {
      persistence: {
        key,
        storage,
        version: 2,
        clearOnReset: false,
        migrate: () => null as never
      }
    });

    const snapshot = machine.getSnapshot();
    expect(snapshot.currentStepId).toBe("start");
    expect(snapshot.history.timeline).toEqual(["start"]);
  });

  it("respects clearOnReset option", async () => {
    const keep = createStorage();
    const clear = createStorage();

    const machineKeep = createJourneyMachine(createJourney(), {
      persistence: { key: "keep", storage: keep.storage, clearOnReset: false }
    });
    const machineClear = createJourneyMachine(createJourney(), {
      persistence: { key: "clear", storage: clear.storage, clearOnReset: true }
    });

    await machineKeep.send({ type: "goToNextStep" });
    await machineClear.send({ type: "goToNextStep" });

    machineKeep.resetMachine();
    machineClear.resetMachine();

    expect(keep.store.get("keep")).toBeTruthy();
    expect(clear.store.get("clear")).toBeUndefined();
  });

  it("createPersistenceController requires stepMeta and hydrates initial snapshot", () => {
    const { storage } = createStorage();
    const controller = createPersistenceController({
      initial: "start" as StepId,
      context: { count: 0 },
      stepMeta: {
        start: { title: "Start" },
        details: { title: "Details" },
        review: { title: "Review" }
      },
      steps: {
        start: {},
        details: {},
        review: {}
      },
      options: {
        persistence: {
          key: "controller",
          storage
        }
      }
    });

    const snapshot = controller.hydrateSnapshot();
    expect(snapshot.currentStepId).toBe("start");
    expect(snapshot.stepMeta.start).toEqual({ title: "Start" });
  });

  it("uses persisted complete/terminated statuses when they are valid", () => {
    const { storage, store } = createStorage();

    store.set(
      "journey:terminated",
      JSON.stringify({
        version: 1,
        snapshot: {
          currentStepId: "details",
          timeline: ["start", "details"],
          index: 1,
          context: { count: 1 },
          status: "terminated",
          visited: { start: true, details: true, review: false },
          stepMeta: {
            start: { title: "Start" },
            details: { title: "Details" },
            review: { title: "Review" }
          }
        }
      })
    );
    store.set(
      "journey:complete",
      JSON.stringify({
        version: 1,
        snapshot: {
          currentStepId: "review",
          timeline: ["start", "details", "review"],
          index: 2,
          context: { count: 2 },
          status: "complete",
          visited: { start: true, details: true, review: true },
          stepMeta: {
            start: { title: "Start" },
            details: { title: "Details" },
            review: { title: "Review" }
          }
        }
      })
    );

    const terminatedMachine = createJourneyMachine(createJourney(), {
      persistence: { key: "journey:terminated", storage, clearOnReset: false }
    });
    const completeMachine = createJourneyMachine(createJourney(), {
      persistence: { key: "journey:complete", storage, clearOnReset: false }
    });

    expect(terminatedMachine.getSnapshot().status).toBe("terminated");
    expect(completeMachine.getSnapshot().status).toBe("complete");
  });

  it("coerces malformed persisted fields (index, status, visited, stepMeta) and rewrites", () => {
    const { storage, store } = createStorage();
    const key = "journey:coerce-complex";

    store.set(
      key,
      JSON.stringify({
        version: 1,
        snapshot: {
          currentStepId: "details",
          timeline: ["start", "details", "review"],
          index: "not-a-number",
          context: { count: 9 },
          status: "stale",
          visited: 42,
          stepMeta: null
        }
      })
    );

    const machine = createJourneyMachine(createJourney(), {
      persistence: { key, storage, clearOnReset: false }
    });
    const snapshot = machine.getSnapshot();

    expect(snapshot.currentStepId).toBe("details");
    expect(snapshot.history.index).toBe(1);
    expect(snapshot.status).toBe("running");
    expect(snapshot.visited).toEqual({
      start: true,
      details: true,
      review: true
    });
    expect(snapshot.stepMeta).toEqual({
      start: { title: "Start" },
      details: { title: "Details" },
      review: { title: "Review" }
    });

    const rewritten = JSON.parse(store.get(key) ?? "{}");
    expect(rewritten.snapshot.history.index).toBe(1);
    expect(rewritten.snapshot.status).toBe("running");
  });

  it("marks visited rewrites when visited record has missing or invalid values", () => {
    const { storage, store } = createStorage();
    const key = "journey:visited-record-rewrite";

    store.set(
      key,
      JSON.stringify({
        version: 1,
        snapshot: {
          currentStepId: "review",
          timeline: ["start", "details", "review"],
          index: 2,
          context: { count: 3 },
          status: "running",
          visited: {
            start: true,
            details: "yes"
          },
          stepMeta: {
            start: { title: "Start" },
            details: { title: "Details" },
            review: { title: "Review" }
          }
        }
      })
    );

    const machine = createJourneyMachine(createJourney(), {
      persistence: { key, storage, clearOnReset: false }
    });

    expect(machine.getSnapshot().visited).toEqual({
      start: true,
      details: false,
      review: false
    });

    const rewritten = JSON.parse(store.get(key) ?? "{}");
    expect(rewritten.snapshot.visited).toEqual({
      start: true,
      details: false,
      review: false
    });
  });

  it("falls back to initial snapshot for invalid persisted envelope shapes", () => {
    const { storage, store } = createStorage();

    store.set("journey:not-record", JSON.stringify({ version: 1, snapshot: "nope" }));
    store.set("journey:bad-version", JSON.stringify({ version: "x", snapshot: {} }));
    store.set("journey:no-coercible-snapshot", JSON.stringify({ version: 1, snapshot: {} }));

    const notRecord = createJourneyMachine(createJourney(), {
      persistence: { key: "journey:not-record", storage, clearOnReset: false }
    });
    const badVersion = createJourneyMachine(createJourney(), {
      persistence: { key: "journey:bad-version", storage, clearOnReset: false }
    });
    const noCoercible = createJourneyMachine(createJourney(), {
      persistence: { key: "journey:no-coercible-snapshot", storage, clearOnReset: false }
    });

    expect(notRecord.getSnapshot().currentStepId).toBe("start");
    expect(badVersion.getSnapshot().currentStepId).toBe("start");
    expect(noCoercible.getSnapshot().currentStepId).toBe("start");
  });

  it("falls back to initial snapshot when deserialize returns non-record", () => {
    const { storage, store } = createStorage();
    const key = "journey:deserialize-non-record";
    store.set(key, "raw");

    const machine = createJourneyMachine(createJourney(), {
      persistence: {
        key,
        storage,
        deserialize: () => 42 as unknown as { version: number; snapshot: unknown }
      }
    });

    expect(machine.getSnapshot().currentStepId).toBe("start");
  });

  it("handles array-like visited payloads through visitedFromArray coercion path", () => {
    const { storage, store } = createStorage();
    const key = "journey:visited-array-like";
    store.set(key, "raw");

    const visitedArrayLike = Object.assign(() => undefined, {
      filter: () => ["start", "review"]
    });
    const nativeIsArray = Array.isArray;
    const isArraySpy = vi
      .spyOn(Array, "isArray")
      .mockImplementation((value: unknown): value is unknown[] =>
        value === visitedArrayLike ? true : nativeIsArray(value)
      );

    try {
      const machine = createJourneyMachine(createJourney(), {
        persistence: {
          key,
          storage,
          clearOnReset: false,
          deserialize: () => ({
            version: 1,
            snapshot: {
              currentStepId: "review",
              timeline: ["start", "details", "review"],
              index: 2,
              context: { count: 7 },
              status: "running",
              visited: visitedArrayLike,
              stepMeta: {
                start: { title: "Start" },
                details: { title: "Details" },
                review: { title: "Review" }
              }
            }
          })
        }
      });

      expect(machine.getSnapshot().visited).toEqual({
        start: true,
        details: false,
        review: true
      });
    } finally {
      isArraySpy.mockRestore();
    }
  });

  it("handles storage/serialization errors via onError hooks", async () => {
    const onError = vi.fn();
    const throwingStorage: JourneyStorage = {
      getItem: vi.fn(() => {
        throw new Error("get failed");
      }),
      setItem: vi.fn(() => {
        throw new Error("set failed");
      }),
      removeItem: vi.fn(() => {
        throw new Error("remove failed");
      })
    };

    const machine = createJourneyMachine(createJourney(), {
      persistence: {
        key: "journey:throwing",
        storage: throwingStorage,
        clearOnReset: true,
        onError
      }
    });

    expect(machine.getSnapshot().currentStepId).toBe("start");
    await machine.send({ type: "goToNextStep" });
    machine.resetMachine();

    expect(onError).toHaveBeenCalled();
    const messages = onError.mock.calls.map(([error]) => (error as Error).message);
    expect(messages).toContain("get failed");
    expect(messages).toContain("set failed");
    expect(messages).toContain("remove failed");
  });

  it("handles deserialize failures via onError and returns the initial snapshot", () => {
    const { storage, store } = createStorage();
    const onError = vi.fn();
    store.set("journey:deserialize-fail", "raw");

    const machine = createJourneyMachine(createJourney(), {
      persistence: {
        key: "journey:deserialize-fail",
        storage,
        deserialize: () => {
          throw new Error("deserialize failed");
        },
        onError
      }
    });

    expect(machine.getSnapshot().currentStepId).toBe("start");
    expect(onError).toHaveBeenCalled();
  });

  it("disables persistence when reading default storage throws and reports via onError", async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    const onError = vi.fn();

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("blocked");
      }
    });

    try {
      const machine = createJourneyMachine(createJourney(), {
        persistence: {
          key: "journey:blocked-default-storage",
          onError
        }
      });

      expect(machine.getSnapshot().currentStepId).toBe("start");
      await machine.send({ type: "goToNextStep" });
      expect(machine.getSnapshot().currentStepId).toBe("details");

      expect(onError).toHaveBeenCalledTimes(1);
      expect((onError.mock.calls[0]?.[0] as Error).message).toBe("blocked");
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, "localStorage", originalDescriptor);
      } else {
        delete (globalThis as { localStorage?: unknown }).localStorage;
      }
    }
  });

  it("disables persistence when default storage is unavailable", async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: undefined
    });

    try {
      const machine = createJourneyMachine(createJourney(), {
        persistence: { key: "journey:no-default-storage" }
      });

      await machine.send({ type: "goToNextStep" });
      expect(machine.getSnapshot().currentStepId).toBe("details");
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, "localStorage", originalDescriptor);
      } else {
        delete (globalThis as { localStorage?: unknown }).localStorage;
      }
    }
  });
});
