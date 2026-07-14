import { describe, expect, it, vi } from "vitest";

import {
  createJourneyMachine,
  type JourneyDefinition,
  type JourneyMachinePlugin,
  type JourneySnapshot
} from "@rxova/journey-core";
import {
  createAutosavePlugin,
  type JourneyAutosaveMachineExtension
} from "@rxova/journey-core/autosave";
import { resolveJourneyDefinition } from "../src/journey-machine/resolve-journey-definition";
import type { JourneyStorage } from "../src/types";

type StepId = "start" | "review";
type Context = {
  count: number;
  profile?: {
    name: string;
  };
};

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

const createJourney = (): JourneyDefinition<Context, StepId> => ({
  initial: "start",
  context: { count: 0 },
  steps: {
    start: {},
    review: {}
  },
  transitions: {
    start: {
      goToNextStep: [{ to: "review" }]
    },
    review: {
      completeJourney: true
    }
  }
});

describe("autosave plugin", () => {
  it("debounces writes and hydrates from saved snapshots", async () => {
    vi.useFakeTimers();
    const { storage, store } = createStorage();
    const onSaved = vi.fn();

    const machineA = createJourneyMachine(createJourney(), {
      plugins: [
        createAutosavePlugin({
          key: "journey:autosave",
          storage,
          debounceMs: 50,
          onSaved
        })
      ] as const
    });

    await machineA.controls.start();
    await machineA.updateContext((context) => ({ ...context, count: 2 }));
    await machineA.goToNextStep();

    expect(machineA.getAutosaveState().status).toBe("pending");
    expect(store.get("journey:autosave")).toBeUndefined();

    await vi.advanceTimersByTimeAsync(50);

    expect(machineA.getAutosaveState().status).toBe("saved");
    expect(onSaved).toHaveBeenCalledTimes(1);

    const persisted = JSON.parse(store.get("journey:autosave") ?? "{}");
    expect(persisted.snapshot.currentStepId).toBe("review");
    expect(persisted.snapshot.context.count).toBe(2);

    const machineB = createJourneyMachine(createJourney(), {
      plugins: [
        createAutosavePlugin({
          key: "journey:autosave",
          storage,
          debounceMs: 50
        })
      ] as const
    });

    expect(machineB.getSnapshot().currentStepId).toBe("review");
    expect(machineB.getSnapshot().context.count).toBe(2);
    vi.useRealTimers();
  });

  it("hydrates autosave snapshots on top of earlier hydrate plugins", () => {
    const { storage, store } = createStorage();

    store.set(
      "journey:autosave:compose",
      JSON.stringify({
        version: 1,
        snapshot: {
          currentStepId: "review",
          history: {
            timeline: ["start", "review"],
            index: 1
          },
          context: { count: 3 },
          status: "running",
          visited: { start: true, review: true }
        }
      })
    );

    type ComposedContext = Context & { injected: boolean };
    type ComposedSnapshot = JourneySnapshot<ComposedContext, StepId>;
    const plugins = [
      {
        name: "upstream-hydrator",
        setup: (() => ({
          hydrateSnapshot: (snapshot: ComposedSnapshot) => ({
            ...snapshot,
            context: {
              ...snapshot.context,
              injected: true
            }
          })
        })) as unknown as JourneyMachinePlugin["setup"]
      },
      createAutosavePlugin<ComposedContext, StepId>({
        key: "journey:autosave:compose",
        storage,
        debounceMs: 0
      })
    ] as const;
    const machine = createJourneyMachine<
      ComposedContext,
      StepId,
      never,
      unknown,
      Record<never, never>,
      typeof plugins
    >(
      {
        initial: "start",
        context: { count: 0, injected: false },
        steps: {
          start: {},
          review: {}
        },
        transitions: {
          start: {
            goToNextStep: [{ to: "review" }]
          },
          review: {
            completeJourney: true
          }
        }
      },
      { plugins }
    );

    expect(machine.getSnapshot()).toMatchObject({
      currentStepId: "review",
      status: "idled",
      context: { count: 3, injected: true }
    });
  });

  it("flushes immediately and clears persisted drafts", async () => {
    const { storage, store } = createStorage();
    const machine = createJourneyMachine(createJourney(), {
      plugins: [
        createAutosavePlugin({
          key: "journey:autosave:flush",
          storage,
          debounceMs: 500
        })
      ] as const
    });

    await machine.controls.start();
    await machine.updateContext((context) => ({ ...context, count: 4 }));

    expect(machine.getAutosaveState().status).toBe("pending");

    await machine.flushAutosave();

    expect(machine.getAutosaveState().status).toBe("saved");
    expect(JSON.parse(store.get("journey:autosave:flush") ?? "{}").snapshot.context.count).toBe(4);

    machine.clearAutosave();

    expect(machine.getAutosaveState()).toEqual({ status: "idle" });
    expect(store.has("journey:autosave:flush")).toBe(false);
  });

  it("supports context filtering without the persistence plugin", async () => {
    const { storage, store } = createStorage();
    const machine = createJourneyMachine(
      {
        initial: "start",
        context: {
          count: 0,
          profile: {
            name: "Ada"
          }
        },
        steps: {
          start: {},
          review: {}
        },
        transitions: ["start", "review"]
      } satisfies JourneyDefinition<Context, StepId>,
      {
        plugins: [
          createAutosavePlugin({
            key: "journey:autosave:filter",
            storage,
            debounceMs: 0,
            allowList: ["profile.name"]
          })
        ] as const
      }
    );

    await machine.controls.start();
    await machine.updateContext((context) => ({
      ...context,
      count: 7,
      profile: { name: "Grace" }
    }));
    await machine.flushAutosave();

    const persisted = JSON.parse(store.get("journey:autosave:filter") ?? "{}");
    expect(persisted.snapshot.context).toEqual({
      profile: {
        name: "Grace"
      }
    });
  });

  it("supports hydrate:false and only saves configured snapshot reasons", async () => {
    const { storage, store } = createStorage();

    store.set(
      "journey:autosave:no-hydrate",
      JSON.stringify({
        version: 1,
        snapshot: {
          currentStepId: "review",
          history: {
            timeline: ["start", "review"],
            index: 1
          },
          context: { count: 9 },
          status: "running",
          visited: { start: true, review: true }
        }
      })
    );

    type ComposedContext = Context & { injected: boolean };
    type ComposedSnapshot = JourneySnapshot<ComposedContext, StepId>;
    const plugins = [
      {
        name: "upstream-hydrator",
        setup: (() => ({
          hydrateSnapshot: (snapshot: ComposedSnapshot) => ({
            ...snapshot,
            context: {
              ...snapshot.context,
              injected: true
            }
          })
        })) as unknown as JourneyMachinePlugin["setup"]
      },
      createAutosavePlugin<ComposedContext, StepId>({
        key: "journey:autosave:no-hydrate",
        storage,
        hydrate: false,
        saveOn: ["transition"],
        debounceMs: 0
      })
    ] as const;
    const machine = createJourneyMachine<
      ComposedContext,
      StepId,
      never,
      unknown,
      Record<never, never>,
      typeof plugins
    >(
      {
        initial: "start",
        context: { count: 0, injected: false },
        steps: {
          start: {},
          review: {}
        },
        transitions: {
          start: {
            goToNextStep: [{ to: "review" }]
          },
          review: {
            completeJourney: true
          }
        }
      },
      { plugins }
    );

    expect(machine.getSnapshot()).toMatchObject({
      currentStepId: "start",
      context: { count: 0, injected: true }
    });

    await machine.controls.start();
    await machine.updateContext((context) => ({ ...context, count: 5 }));

    expect(
      JSON.parse(store.get("journey:autosave:no-hydrate") ?? "{}").snapshot.context.count
    ).toBe(9);

    await machine.goToNextStep();

    expect(JSON.parse(store.get("journey:autosave:no-hydrate") ?? "{}").snapshot.context).toEqual({
      count: 5,
      injected: true
    });
  });

  it("ignores async snapshots and clears pending autosave on reset", () => {
    const { storage, store } = createStorage();
    const journey = createJourney();
    const resolvedJourney = resolveJourneyDefinition(journey);
    const plugin = createAutosavePlugin<Context, StepId>({
      key: "journey:autosave:async",
      storage,
      saveOn: ["context", "reset", "transition"],
      debounceMs: 50
    });
    const hooks = plugin.setup({
      journey,
      resolvedJourney,
      options: {
        requireExplicitCompletion: false,
        defaultTimeoutMs: undefined
      },
      buildInitialSnapshot: () => ({
        type: "graph",
        currentStepId: "start",
        history: {
          timeline: ["start"],
          index: 0
        },
        context: { count: 0 },
        visited: { start: true, review: false },
        status: "idled",
        async: {
          isLoading: false,
          byStep: {
            start: { phase: "idle", eventType: null, transitionId: null, error: null },
            review: { phase: "idle", eventType: null, transitionId: null, error: null }
          }
        }
      })
    });
    const autosaveApi = hooks.augmentMachine?.({
      machine: {} as never,
      journey,
      resolvedJourney
    }) as JourneyAutosaveMachineExtension | undefined;
    const snapshot = {
      type: "graph" as const,
      currentStepId: "start" as StepId,
      history: {
        timeline: ["start"] as const,
        index: 0
      },
      context: { count: 1 },
      visited: { start: true, review: false },
      status: "running" as const,
      async: {
        isLoading: true,
        byStep: {
          start: {
            phase: "evaluating-when" as const,
            eventType: "goToNextStep",
            transitionId: "t-async",
            error: null
          },
          review: { phase: "idle" as const, eventType: null, transitionId: null, error: null }
        }
      }
    };

    hooks.onSnapshotChange?.({
      previousSnapshot: snapshot,
      snapshot,
      reason: "async"
    });

    expect(autosaveApi?.getAutosaveState()).toEqual({ status: "idle" });
    expect(store.has("journey:autosave:async")).toBe(false);

    hooks.onSnapshotChange?.({
      previousSnapshot: snapshot,
      snapshot,
      reason: "context"
    });
    expect(autosaveApi?.getAutosaveState()).toMatchObject({
      status: "pending",
      pendingReason: "context"
    });

    hooks.onSnapshotChange?.({
      previousSnapshot: snapshot,
      snapshot,
      reason: "reset"
    });
    expect(autosaveApi?.getAutosaveState()).toEqual({ status: "idle" });
    expect(store.has("journey:autosave:async")).toBe(false);
  });

  it("surfaces persistence save errors while preserving prior autosave metadata", async () => {
    const store = new Map<string, string>();
    let shouldFail = false;
    const storage: JourneyStorage = {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        if (shouldFail) {
          throw new Error("save failed");
        }
        store.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key);
      })
    };
    const onError = vi.fn();
    const onSaved = vi.fn();

    const machine = createJourneyMachine(createJourney(), {
      plugins: [
        createAutosavePlugin({
          key: "journey:autosave:error",
          storage,
          saveOn: ["context", "transition"],
          debounceMs: 0,
          onError,
          onSaved
        })
      ] as const
    });

    await machine.controls.start();
    await machine.updateContext((context) => ({ ...context, count: 2 }));
    expect(machine.getAutosaveState()).toMatchObject({
      status: "saved",
      lastSavedAt: expect.any(Number)
    });
    expect(onSaved).toHaveBeenCalledTimes(1);

    shouldFail = true;
    await machine.goToNextStep();

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "save failed" }));
    expect(machine.getAutosaveState()).toMatchObject({
      status: "error",
      lastSavedAt: expect.any(Number),
      pendingReason: "transition",
      error: expect.objectContaining({ message: "save failed" })
    });
  });

  it("surfaces hydrate errors without prior autosave metadata", () => {
    const storage: JourneyStorage = {
      getItem: vi.fn(() => {
        throw new Error("hydrate failed");
      }),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
    const onError = vi.fn();

    const machine = createJourneyMachine(createJourney(), {
      plugins: [
        createAutosavePlugin({
          key: "journey:autosave:hydrate-error",
          storage,
          debounceMs: 0,
          onError
        })
      ] as const
    });

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "hydrate failed" }));
    expect(machine.getAutosaveState()).toMatchObject({
      status: "error",
      error: expect.objectContaining({ message: "hydrate failed" })
    });
    expect(machine.getAutosaveState()).not.toHaveProperty("lastSavedAt");
    expect(machine.getAutosaveState()).not.toHaveProperty("pendingReason");
  });

  it("flushes no-op without pending work and dispose cancels scheduled saves", async () => {
    vi.useFakeTimers();
    const { storage, store } = createStorage();
    const machine = createJourneyMachine(createJourney(), {
      plugins: [
        createAutosavePlugin({
          key: "journey:autosave:dispose",
          storage,
          debounceMs: Number.NaN
        })
      ] as const
    });

    await machine.flushAutosave();
    await machine.controls.start();
    await machine.updateContext((context) => ({ ...context, count: 6 }));
    expect(machine.getAutosaveState().status).toBe("pending");

    machine.dispose();
    await vi.advanceTimersByTimeAsync(500);

    expect(store.has("journey:autosave:dispose")).toBe(false);
    vi.useRealTimers();
  });

  it("isolates autosave state per machine when one plugin instance is reused", async () => {
    vi.useFakeTimers();
    try {
      const { storage } = createStorage();
      const plugin = createAutosavePlugin<Context, StepId>({
        key: "journey:autosave:iso",
        storage,
        debounceMs: 50
      });
      const m1 = createJourneyMachine(createJourney(), { plugins: [plugin] as const });
      const m2 = createJourneyMachine(createJourney(), { plugins: [plugin] as const });

      await m1.controls.start();

      // m1 scheduled a debounced save; m2 was never started and stays independent.
      expect(m1.getAutosaveState().status).toBe("pending");
      expect(m2.getAutosaveState().status).toBe("idle");

      await vi.advanceTimersByTimeAsync(60);
      expect(m1.getAutosaveState().status).toBe("saved");
      expect(m2.getAutosaveState().status).toBe("idle");

      m1.dispose();
      m2.dispose();
    } finally {
      vi.useRealTimers();
    }
  });
});
