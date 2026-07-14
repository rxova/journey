import { describe, expect, it, vi } from "vitest";

import {
  createJourneyMachine,
  type JourneyDefinition,
  type JourneyJsonObject,
  type JourneyMachinePlugin,
  type JourneySnapshot
} from "@rxova/journey-core";
import type { JourneyStorage } from "../src/types";
import {
  createPersistenceController,
  createPersistencePlugin,
  type JourneyPersistenceOptions
} from "@rxova/journey-core/persistence";

type StepId = "start" | "details" | "review";
type EventMap = { type: "back"; payload?: unknown };
type Context = { count: number };
type SensitiveContext = {
  profile: {
    name: string;
    email: string;
  };
  auth: {
    password: string;
    token: string;
    sessions: string[];
  };
  preferences: {
    theme: string;
    locale: string;
  };
};
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

const createJourney = (): JourneyDefinition<Context, StepId, EventMap, Meta> => ({
  initial: "start",
  context: { count: 0 },
  steps: {
    start: {
      meta: { title: "Start" }
    },
    details: {
      meta: { title: "Details" }
    },
    review: { meta: { title: "Review" } }
  },
  transitions: {
    start: { goToNextStep: [{ to: "details" }] },
    details: { goToNextStep: [{ to: "review" }] }
  }
});

const createSensitiveJourney = (): JourneyDefinition<SensitiveContext, StepId, EventMap, Meta> => ({
  initial: "start",
  context: {
    profile: {
      name: "Guest",
      email: "guest@example.com"
    },
    auth: {
      password: "",
      token: "initial-token",
      sessions: ["initial-session"]
    },
    preferences: {
      theme: "light",
      locale: "en"
    }
  },
  steps: {
    start: {
      meta: { title: "Start" }
    },
    details: {
      meta: { title: "Details" }
    },
    review: { meta: { title: "Review" } }
  },
  transitions: {
    start: { goToNextStep: [{ to: "details" }] },
    details: { goToNextStep: [{ to: "review" }] }
  }
});

const withPersistence = <TContext extends JourneyJsonObject>(
  options: JourneyPersistenceOptions<TContext, StepId>
) => ({
  plugins: [createPersistencePlugin(options)] as const
});

const flushAsync = async () => {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};

const withNodeEnv = async (value: string | undefined, run: () => void | Promise<void>) => {
  const previous = process.env.NODE_ENV;

  if (value === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = value;
  }

  try {
    await run();
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previous;
    }
  }
};

describe("persistence", () => {
  it("persists and hydrates timeline/index snapshots", async () => {
    const { storage, store } = createStorage();
    const key = "journey:timeline";

    const machineA = createJourneyMachine(
      createJourney(),
      withPersistence({ key, storage, clearOnReset: false })
    );
    await machineA.controls.start();

    await machineA.send({ type: "goToNextStep" });
    await machineA.send({ type: "goToNextStep" });
    await machineA.goToPreviousStep();

    const raw = store.get(key);
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.snapshot.history.timeline).toEqual(["start", "details", "review"]);
    expect(parsed.snapshot.history.index).toBe(1);
    expect(parsed.snapshot.currentStepId).toBe("details");
    expect(parsed.snapshot).not.toHaveProperty("stepMeta");

    const machineB = createJourneyMachine(
      createJourney(),
      withPersistence({ key, storage, clearOnReset: false })
    );

    const hydrated = machineB.getSnapshot();
    expect(hydrated.history.timeline).toEqual(["start", "details", "review"]);
    expect(hydrated.history.index).toBe(1);
    expect(hydrated.currentStepId).toBe("details");
    expect(machineB.getStepMeta("review")).toEqual({ title: "Review" });
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

    const machine = createJourneyMachine(
      createJourney(),
      withPersistence({ key, storage, clearOnReset: false })
    );

    const snapshot = machine.getSnapshot();
    expect(snapshot.history.timeline).toEqual(["details"]);
    expect(snapshot.history.index).toBe(0);
    expect(snapshot.currentStepId).toBe("details");
    expect(machine.getStepMeta("review")).toEqual({ title: "Review" });

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

    const machine = createJourneyMachine(
      createJourney(),
      withPersistence({ key, storage, clearOnReset: false })
    );

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

    const machine = createJourneyMachine(
      createJourney(),
      withPersistence({
        key,
        storage,
        version: 2,
        clearOnReset: false,
        migrate: (_value: unknown, persistedVersion: number) => ({
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
      })
    );

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

    const machine = createJourneyMachine(
      createJourney(),
      withPersistence({ key, storage, clearOnReset: false })
    );

    expect(machine.getSnapshot().context).toEqual({ count: 0 });
  });

  it("falls back to initial snapshot and reports when migrate result cannot be coerced", () => {
    const { storage, store } = createStorage();
    const key = "journey:migrate-invalid";
    const onError = vi.fn();

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

    const machine = createJourneyMachine(
      createJourney(),
      withPersistence({
        key,
        storage,
        version: 2,
        clearOnReset: false,
        migrate: () => null as never,
        onError
      })
    );

    const snapshot = machine.getSnapshot();
    expect(snapshot.currentStepId).toBe("start");
    expect(snapshot.history.timeline).toEqual(["start"]);
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]?.[0] as Error).message).toContain("migrate()");
    expect((onError.mock.calls[0]?.[0] as Error).message).toContain("initial snapshot");
  });

  it("warns in development when migrate result cannot be coerced and onError is omitted", async () => {
    await withNodeEnv("development", async () => {
      const { storage, store } = createStorage();
      const key = "journey:migrate-invalid-dev-warning";
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

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

      const machine = createJourneyMachine(
        createJourney(),
        withPersistence({
          key,
          storage,
          version: 2,
          clearOnReset: false,
          migrate: () => null as never
        })
      );

      expect(machine.getSnapshot().history.timeline).toEqual(["start"]);
      expect(warnSpy).toHaveBeenCalledWith(
        "Journey persistence encountered an error without an onError handler.",
        expect.any(Error)
      );
      warnSpy.mockRestore();
    });
  });

  it("respects clearOnReset option", async () => {
    const keep = createStorage();
    const clear = createStorage();

    const machineKeep = createJourneyMachine(
      createJourney(),
      withPersistence({ key: "keep", storage: keep.storage, clearOnReset: false })
    );
    const machineClear = createJourneyMachine(
      createJourney(),
      withPersistence({ key: "clear", storage: clear.storage, clearOnReset: true })
    );
    await machineKeep.controls.start();
    await machineClear.controls.start();

    await machineKeep.send({ type: "goToNextStep" });
    await machineClear.send({ type: "goToNextStep" });

    await machineKeep.controls.reset();
    await machineClear.controls.reset();

    expect(keep.store.get("keep")).toBeTruthy();
    expect(clear.store.get("clear")).toBeUndefined();
  });

  it("does not persist intermediate async snapshots", async () => {
    const { storage, store } = createStorage();
    const key = "journey:skip-async";
    let resolveGuard!: (value: boolean) => void;

    const machine = createJourneyMachine(
      {
        ...createJourney(),
        transitions: {
          start: {
            goToNextStep: [
              {
                to: "details",
                when: () =>
                  new Promise<boolean>((resolve) => {
                    resolveGuard = resolve;
                  })
              }
            ]
          },
          details: { goToNextStep: [{ to: "review" }] }
        }
      },
      withPersistence({ key, storage, clearOnReset: false })
    );

    await machine.controls.start();
    expect(storage.setItem).toHaveBeenCalledTimes(1);

    const sendPromise = machine.goToNextStep();
    await flushAsync();

    expect(machine.getSnapshot().async.byStep.start.phase).toBe("evaluating-when");
    expect(storage.setItem).toHaveBeenCalledTimes(1);

    resolveGuard(true);
    await sendPromise;

    expect(storage.setItem).toHaveBeenCalledTimes(2);

    const persisted = JSON.parse(store.get(key) ?? "{}");
    expect(persisted.snapshot.currentStepId).toBe("details");
  });

  it("blocks nested sensitive fields on persist and restores them from the initial context", async () => {
    const { storage, store } = createStorage();
    const key = "journey:block-password";

    const machineA = createJourneyMachine(
      createSensitiveJourney(),
      withPersistence({
        key,
        storage,
        clearOnReset: false,
        blockList: ["auth.password"]
      })
    );

    await machineA.controls.start();
    await machineA.updateContext((context) => ({
      ...context,
      auth: {
        ...context.auth,
        password: "session-secret",
        token: "persisted-token"
      },
      preferences: {
        ...context.preferences,
        theme: "dark"
      }
    }));

    const persisted = JSON.parse(store.get(key) ?? "{}");
    expect(persisted.snapshot.context.auth.password).toBeUndefined();
    expect(persisted.snapshot.context.auth.token).toBe("persisted-token");
    expect(persisted.snapshot.context.preferences.theme).toBe("dark");

    const machineB = createJourneyMachine(
      createSensitiveJourney(),
      withPersistence({
        key,
        storage,
        clearOnReset: false,
        blockList: ["auth.password"]
      })
    );

    expect(machineB.getSnapshot().context.auth.password).toBe("");
    expect(machineB.getSnapshot().context.auth.token).toBe("persisted-token");
    expect(machineB.getSnapshot().context.preferences.theme).toBe("dark");
  });

  it("persists only allowed context paths and includes full parent subtrees", async () => {
    const { storage, store } = createStorage();
    const key = "journey:allow-subset";

    const machine = createJourneyMachine(
      createSensitiveJourney(),
      withPersistence({
        key,
        storage,
        clearOnReset: false,
        allowList: ["profile", "preferences.theme"]
      })
    );

    await machine.controls.start();
    await machine.updateContext((context) => ({
      ...context,
      profile: {
        name: "Ada",
        email: "ada@example.com"
      },
      auth: {
        password: "should-not-persist",
        token: "should-not-persist",
        sessions: ["skip-this"]
      },
      preferences: {
        theme: "dark",
        locale: "fr"
      }
    }));

    const persisted = JSON.parse(store.get(key) ?? "{}");
    expect(persisted.snapshot.context).toEqual({
      profile: {
        name: "Ada",
        email: "ada@example.com"
      },
      preferences: {
        theme: "dark"
      }
    });

    const hydrated = createJourneyMachine(
      createSensitiveJourney(),
      withPersistence({
        key,
        storage,
        clearOnReset: false,
        allowList: ["profile", "preferences.theme"]
      })
    ).getSnapshot();

    expect(hydrated.context.profile).toEqual({
      name: "Ada",
      email: "ada@example.com"
    });
    expect(hydrated.context.preferences).toEqual({
      theme: "dark",
      locale: "en"
    });
    expect(hydrated.context.auth).toEqual({
      password: "",
      token: "initial-token",
      sessions: ["initial-session"]
    });
  });

  it("lets blockList win when paths overlap with allowList", async () => {
    const { storage, store } = createStorage();
    const key = "journey:block-overrides-allow";

    const machine = createJourneyMachine(
      createSensitiveJourney(),
      withPersistence({
        key,
        storage,
        clearOnReset: false,
        allowList: ["auth", "preferences"],
        blockList: ["auth.password", "preferences.locale"]
      })
    );

    await machine.controls.start();
    await machine.updateContext((context) => ({
      ...context,
      auth: {
        password: "blocked-secret",
        token: "persisted-token",
        sessions: ["session-a", "session-b"]
      },
      preferences: {
        theme: "dark",
        locale: "es"
      }
    }));

    const persisted = JSON.parse(store.get(key) ?? "{}");
    expect(persisted.snapshot.context).toEqual({
      auth: {
        token: "persisted-token",
        sessions: ["session-a", "session-b"]
      },
      preferences: {
        theme: "dark"
      }
    });
  });

  it("rewrites stored context when hydration encounters paths that are now blocked", () => {
    const { storage, store } = createStorage();
    const key = "journey:rewrite-blocked-context";

    store.set(
      key,
      JSON.stringify({
        version: 1,
        snapshot: {
          currentStepId: "details",
          timeline: ["start", "details"],
          index: 1,
          context: {
            profile: {
              name: "Ada",
              email: "ada@example.com"
            },
            auth: {
              password: "legacy-secret",
              token: "persisted-token",
              sessions: ["session-a"]
            },
            preferences: {
              theme: "dark",
              locale: "fr"
            }
          },
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

    const machine = createJourneyMachine(
      createSensitiveJourney(),
      withPersistence({
        key,
        storage,
        clearOnReset: false,
        allowList: ["profile", "auth", "preferences.theme"],
        blockList: ["auth.password"]
      })
    );

    expect(machine.getSnapshot().context).toEqual({
      profile: {
        name: "Ada",
        email: "ada@example.com"
      },
      auth: {
        password: "",
        token: "persisted-token",
        sessions: ["session-a"]
      },
      preferences: {
        theme: "dark",
        locale: "en"
      }
    });

    const rewritten = JSON.parse(store.get(key) ?? "{}");
    expect(rewritten.snapshot.context).toEqual({
      profile: {
        name: "Ada",
        email: "ada@example.com"
      },
      auth: {
        token: "persisted-token",
        sessions: ["session-a"]
      },
      preferences: {
        theme: "dark"
      }
    });
  });

  it("persists whole arrays only through their parent object key", async () => {
    const { storage, store } = createStorage();
    const key = "journey:allow-array-parent";

    const machine = createJourneyMachine(
      createSensitiveJourney(),
      withPersistence({
        key,
        storage,
        clearOnReset: false,
        allowList: ["auth.sessions"]
      })
    );

    await machine.controls.start();
    await machine.updateContext((context) => ({
      ...context,
      auth: {
        password: "skip",
        token: "skip",
        sessions: ["session-a", "session-b"]
      }
    }));

    const persisted = JSON.parse(store.get(key) ?? "{}");
    expect(persisted.snapshot.context).toEqual({
      auth: {
        sessions: ["session-a", "session-b"]
      }
    });
  });

  it("persists an empty context when allowList is explicitly empty", async () => {
    const { storage, store } = createStorage();
    const key = "journey:empty-allow-list";

    const machine = createJourneyMachine(
      createSensitiveJourney(),
      withPersistence({
        key,
        storage,
        clearOnReset: false,
        allowList: []
      })
    );

    await machine.controls.start();
    await machine.updateContext((context) => ({
      ...context,
      profile: {
        name: "Ada",
        email: "ada@example.com"
      }
    }));

    const persisted = JSON.parse(store.get(key) ?? "{}");
    expect(persisted.snapshot.context).toEqual({});

    const hydrated = createJourneyMachine(
      createSensitiveJourney(),
      withPersistence({
        key,
        storage,
        clearOnReset: false,
        allowList: []
      })
    );

    expect(hydrated.getSnapshot().context).toEqual(createSensitiveJourney().context);
  });

  it("createPersistenceController hydrates the initial snapshot shape", () => {
    const { storage } = createStorage();
    const controller = createPersistenceController({
      initial: "start" as StepId,
      shape: { type: "graph" },
      context: { count: 0 },
      steps: {
        start: {},
        details: {},
        review: {}
      },
      options: {
        key: "controller",
        storage
      }
    });

    const snapshot = controller.hydrateSnapshot();
    expect(snapshot.currentStepId).toBe("start");
    expect(snapshot.status).toBe("idled");
  });

  it("createPersistenceController returns the provided base snapshot when nothing is persisted", () => {
    const { storage } = createStorage();
    const controller = createPersistenceController({
      initial: "start" as StepId,
      shape: { type: "graph" },
      context: { count: 0 },
      steps: {
        start: {},
        details: {},
        review: {}
      },
      options: {
        key: "controller:base",
        storage
      }
    });

    const baseSnapshot = {
      type: "graph" as const,
      currentStepId: "details" as StepId,
      history: {
        timeline: ["start", "details"] as const,
        index: 1
      },
      context: { count: 99 },
      visited: { start: true, details: true, review: false },
      status: "completed" as const,
      async: {
        isLoading: true,
        byStep: {
          start: { phase: "idle" as const, eventType: null, transitionId: null, error: null },
          details: {
            phase: "evaluating-when" as const,
            eventType: "goToNextStep",
            transitionId: "t-base",
            error: null
          },
          review: { phase: "idle" as const, eventType: null, transitionId: null, error: null }
        }
      }
    };

    const snapshot = controller.hydrateSnapshot(baseSnapshot);

    expect(snapshot).toEqual(baseSnapshot);
    expect(snapshot).not.toBe(baseSnapshot);
  });

  it("createPersistenceController no-ops cleanly when persistence options are omitted", () => {
    const controller = createPersistenceController({
      initial: "start" as StepId,
      shape: { type: "graph" },
      context: { count: 0 },
      steps: {
        start: {},
        details: {},
        review: {}
      }
    });

    const snapshot = controller.hydrateSnapshot();
    controller.removePersistedSnapshot();

    expect(snapshot.currentStepId).toBe("start");
    expect(snapshot.status).toBe("idled");
  });

  it("composes persistence hydration on top of earlier hydrate plugins", () => {
    const { storage, store } = createStorage();
    const key = "journey:compose";

    store.set(
      key,
      JSON.stringify({
        version: 1,
        snapshot: {
          currentStepId: "details",
          history: {
            timeline: ["start", "details"],
            index: 1
          },
          context: { count: 4 },
          status: "running",
          visited: { start: true, details: true, review: false }
        }
      })
    );

    type ComposedContext = { count: number; injected: boolean };
    type ComposedSnapshot = JourneySnapshot<ComposedContext, StepId>;
    const plugins = [
      {
        name: "inject-upstream-defaults",
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
      createPersistencePlugin<ComposedContext, StepId>({
        key,
        storage,
        clearOnReset: false
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
          details: {},
          review: {}
        },
        transitions: {
          start: { goToNextStep: [{ to: "details" }] },
          details: { goToNextStep: [{ to: "review" }] }
        }
      },
      { plugins }
    );

    expect(machine.getSnapshot()).toMatchObject({
      currentStepId: "details",
      status: "idled",
      context: { count: 4, injected: true }
    });
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
          status: "completed",
          visited: { start: true, details: true, review: true },
          stepMeta: {
            start: { title: "Start" },
            details: { title: "Details" },
            review: { title: "Review" }
          }
        }
      })
    );

    const terminatedMachine = createJourneyMachine(
      createJourney(),
      withPersistence({ key: "journey:terminated", storage, clearOnReset: false })
    );
    const completeMachine = createJourneyMachine(
      createJourney(),
      withPersistence({ key: "journey:complete", storage, clearOnReset: false })
    );

    expect(terminatedMachine.getSnapshot().status).toBe("terminated");
    expect(completeMachine.getSnapshot().status).toBe("completed");
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

    const machine = createJourneyMachine(
      createJourney(),
      withPersistence({ key, storage, clearOnReset: false })
    );
    const snapshot = machine.getSnapshot();

    expect(snapshot.currentStepId).toBe("details");
    expect(snapshot.history.index).toBe(1);
    expect(snapshot.status).toBe("idled");
    expect(snapshot.visited).toEqual({
      start: true,
      details: true,
      review: true
    });
    expect(machine.getStepMeta("start")).toEqual({ title: "Start" });
    expect(machine.getStepMeta("details")).toEqual({ title: "Details" });
    expect(machine.getStepMeta("review")).toEqual({ title: "Review" });

    const rewritten = JSON.parse(store.get(key) ?? "{}");
    expect(rewritten.snapshot.history.index).toBe(1);
    expect(rewritten.snapshot.status).toBe("idled");
    expect(rewritten.snapshot).not.toHaveProperty("stepMeta");
  });

  it("merges visited rewrites with timeline when the record has missing or invalid values", () => {
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

    const machine = createJourneyMachine(
      createJourney(),
      withPersistence({ key, storage, clearOnReset: false })
    );

    expect(machine.getSnapshot().visited).toEqual({
      start: true,
      details: true,
      review: true
    });

    const rewritten = JSON.parse(store.get(key) ?? "{}");
    expect(rewritten.snapshot.visited).toEqual({
      start: true,
      details: true,
      review: true
    });
  });

  it("rewrites visited records that contradict the timeline with false values", () => {
    const { storage, store } = createStorage();
    const key = "journey:visited-record-contradiction";

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
            details: false,
            review: false
          },
          stepMeta: {
            start: { title: "Start" },
            details: { title: "Details" },
            review: { title: "Review" }
          }
        }
      })
    );

    const machine = createJourneyMachine(
      createJourney(),
      withPersistence({ key, storage, clearOnReset: false })
    );

    expect(machine.getSnapshot().visited).toEqual({
      start: true,
      details: true,
      review: true
    });

    const rewritten = JSON.parse(store.get(key) ?? "{}");
    expect(rewritten.snapshot.visited).toEqual({
      start: true,
      details: true,
      review: true
    });
  });

  it("falls back to initial snapshot for invalid persisted envelope shapes", () => {
    const { storage, store } = createStorage();

    store.set("journey:not-record", JSON.stringify({ version: 1, snapshot: "nope" }));
    store.set("journey:bad-version", JSON.stringify({ version: "x", snapshot: {} }));
    store.set("journey:no-coercible-snapshot", JSON.stringify({ version: 1, snapshot: {} }));

    const notRecord = createJourneyMachine(
      createJourney(),
      withPersistence({ key: "journey:not-record", storage, clearOnReset: false })
    );
    const badVersion = createJourneyMachine(
      createJourney(),
      withPersistence({ key: "journey:bad-version", storage, clearOnReset: false })
    );
    const noCoercible = createJourneyMachine(
      createJourney(),
      withPersistence({ key: "journey:no-coercible-snapshot", storage, clearOnReset: false })
    );

    expect(notRecord.getSnapshot().currentStepId).toBe("start");
    expect(badVersion.getSnapshot().currentStepId).toBe("start");
    expect(noCoercible.getSnapshot().currentStepId).toBe("start");
  });

  it("falls back to initial snapshot when deserialize returns non-record", () => {
    const { storage, store } = createStorage();
    const key = "journey:deserialize-non-record";
    store.set(key, "raw");

    const machine = createJourneyMachine(
      createJourney(),
      withPersistence({
        key,
        storage,
        deserialize: () => 42 as unknown as { version: number; snapshot: unknown }
      })
    );

    expect(machine.getSnapshot().currentStepId).toBe("start");
  });

  it("merges array-like visited payloads with timeline through visitedFromArray coercion path", () => {
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
      const machine = createJourneyMachine(
        createJourney(),
        withPersistence({
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
        })
      );

      expect(machine.getSnapshot().visited).toEqual({
        start: true,
        details: true,
        review: true
      });
    } finally {
      isArraySpy.mockRestore();
    }
  });

  it("merges real array visited payloads with the timeline and default storage", () => {
    const key = "journey:default-storage-array";
    const store = new Map<string, string>();
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn((entryKey: string) => store.get(entryKey) ?? null),
        setItem: vi.fn((entryKey: string, value: string) => {
          store.set(entryKey, value);
        }),
        removeItem: vi.fn((entryKey: string) => {
          store.delete(entryKey);
        })
      } satisfies JourneyStorage
    });

    store.set(
      key,
      JSON.stringify({
        version: 1,
        snapshot: {
          currentStepId: "review",
          timeline: ["start", "details", "review"],
          index: 2,
          context: { count: 7 },
          status: "running",
          visited: ["start", "review"],
          stepMeta: {
            start: { title: "Start" },
            details: { title: "Details" },
            review: { title: "Review" }
          }
        }
      })
    );

    try {
      const machine = createJourneyMachine(
        createJourney(),
        withPersistence({ key, clearOnReset: false })
      );

      expect(machine.getSnapshot().visited).toEqual({
        start: true,
        details: true,
        review: true
      });

      const rewritten = JSON.parse(store.get(key) ?? "{}");
      expect(rewritten.snapshot.visited).toEqual({
        start: true,
        details: true,
        review: true
      });
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, "localStorage", originalDescriptor);
      } else {
        delete (globalThis as { localStorage?: unknown }).localStorage;
      }
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

    const machine = createJourneyMachine(
      createJourney(),
      withPersistence({
        key: "journey:throwing",
        storage: throwingStorage,
        clearOnReset: true,
        onError
      })
    );

    expect(machine.getSnapshot().currentStepId).toBe("start");
    await machine.controls.start();
    await machine.send({ type: "goToNextStep" });
    await machine.controls.reset();

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

    const machine = createJourneyMachine(
      createJourney(),
      withPersistence({
        key: "journey:deserialize-fail",
        storage,
        deserialize: () => {
          throw new Error("deserialize failed");
        },
        onError
      })
    );

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
      const machine = createJourneyMachine(
        createJourney(),
        withPersistence({
          key: "journey:blocked-default-storage",
          onError
        })
      );

      expect(machine.getSnapshot().currentStepId).toBe("start");
      await machine.controls.start();
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
      const machine = createJourneyMachine(
        createJourney(),
        withPersistence({ key: "journey:no-default-storage" })
      );

      await machine.controls.start();
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

  it("disables persistence when allowList or blockList contains invalid paths", async () => {
    const { storage, store } = createStorage();
    const onError = vi.fn();

    const machine = createJourneyMachine(
      createSensitiveJourney(),
      withPersistence({
        key: "journey:invalid-path-config",
        storage,
        allowList: ["profile", "auth.sessions.0"],
        onError
      })
    );

    await machine.controls.start();
    await machine.updateContext((context) => ({
      ...context,
      profile: {
        name: "Ada",
        email: "ada@example.com"
      }
    }));

    expect(machine.getSnapshot().context.profile.name).toBe("Ada");
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]?.[0] as Error).message).toContain(
      'Persistence allowList entry "auth.sessions.0"'
    );
    expect(store.get("journey:invalid-path-config")).toBeUndefined();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("disables persistence when allowList is not an array or uses wildcard-style paths", () => {
    const { storage } = createStorage();
    const onArrayError = vi.fn();
    const onPathError = vi.fn();

    const nonArrayController = createPersistenceController({
      initial: "start" as StepId,
      shape: { type: "graph" },
      context: { count: 0 },
      steps: {
        start: {},
        details: {},
        review: {}
      },
      options: {
        key: "bad-array",
        storage,
        allowList: "profile" as never,
        onError: onArrayError
      }
    });
    const wildcardController = createPersistenceController({
      initial: "start" as StepId,
      shape: { type: "graph" },
      context: { count: 0 },
      steps: {
        start: {},
        details: {},
        review: {}
      },
      options: {
        key: "bad-path",
        storage,
        allowList: ["profile.*"] as never,
        onError: onPathError
      }
    });

    expect(nonArrayController.hydrateSnapshot().currentStepId).toBe("start");
    expect(wildcardController.hydrateSnapshot().currentStepId).toBe("start");
    expect(onArrayError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Persistence allowList must be an array")
      })
    );
    expect(onPathError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Persistence allowList entry "profile.*"')
      })
    );
  });

  it("disables persistence when allowList entries are non-strings or empty", () => {
    const { storage } = createStorage();
    const onTypeError = vi.fn();
    const onEmptyError = vi.fn();

    const nonStringController = createPersistenceController({
      initial: "start" as StepId,
      shape: { type: "graph" },
      context: { count: 0 },
      steps: {
        start: {},
        details: {},
        review: {}
      },
      options: {
        key: "bad-entry-type",
        storage,
        allowList: [42] as never,
        onError: onTypeError
      }
    });
    const emptyController = createPersistenceController({
      initial: "start" as StepId,
      shape: { type: "graph" },
      context: { count: 0 },
      steps: {
        start: {},
        details: {},
        review: {}
      },
      options: {
        key: "bad-entry-empty",
        storage,
        allowList: [" "] as never,
        onError: onEmptyError
      }
    });

    expect(nonStringController.hydrateSnapshot().currentStepId).toBe("start");
    expect(emptyController.hydrateSnapshot().currentStepId).toBe("start");
    expect(onTypeError).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "JourneyPersistenceError",
        code: "invalid-path",
        message: expect.stringContaining("Persistence allowList entries must be strings")
      })
    );
    expect(onEmptyError).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "JourneyPersistenceError",
        code: "invalid-path",
        message: expect.stringContaining("Persistence allowList entries must not be empty")
      })
    );
  });

  it("rewrites visited arrays that contain invalid persisted entries", () => {
    const { storage, store } = createStorage();
    const key = "journey:visited-array-rewrite";

    store.set(
      key,
      JSON.stringify({
        version: 1,
        snapshot: {
          currentStepId: "review",
          timeline: ["start", "review"],
          index: 1,
          context: { count: 5 },
          status: "running",
          visited: ["start", 42, "missing", "review"]
        }
      })
    );

    const machine = createJourneyMachine(createJourney(), withPersistence({ key, storage }));

    expect(machine.getSnapshot().visited).toEqual({
      start: true,
      details: false,
      review: true
    });
  });

  it("createPersistenceController filters unknown string entries from visited arrays", () => {
    const { storage, store } = createStorage();
    store.set(
      "journey:controller:visited-array",
      JSON.stringify({
        version: 1,
        snapshot: {
          currentStepId: "review",
          history: {
            timeline: ["start", "review"],
            index: 1
          },
          context: { count: 1 },
          status: "running",
          visited: ["start", "unknown-step", "review"]
        }
      })
    );

    const controller = createPersistenceController({
      initial: "start" as StepId,
      shape: { type: "graph" },
      context: { count: 0 },
      steps: {
        start: {},
        details: {},
        review: {}
      },
      options: {
        key: "journey:controller:visited-array",
        storage
      }
    });

    expect(controller.hydrateSnapshot().visited).toEqual({
      start: true,
      details: false,
      review: true
    });
  });

  it("persists non-plain contexts without applying allowList filtering", () => {
    const { storage, store } = createStorage();
    const controller = createPersistenceController({
      initial: "start" as StepId,
      shape: { type: "graph" },
      context: { count: 0 },
      steps: {
        start: {},
        details: {},
        review: {}
      },
      options: {
        key: "journey:non-plain-context",
        storage,
        allowList: ["count"]
      }
    });
    const machine = createJourneyMachine(createJourney());

    controller.persistSnapshot({
      ...machine.getSnapshot(),
      context: new Date("2024-01-02T03:04:05.000Z") as never
    });

    expect(JSON.parse(store.get("journey:non-plain-context") ?? "{}")).toMatchObject({
      snapshot: {
        context: "2024-01-02T03:04:05.000Z"
      }
    });
  });

  it("coerces legacy current fields and undefined persisted context values", () => {
    const storage: JourneyStorage = {
      getItem: vi.fn(() => "legacy"),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };

    const controller = createPersistenceController({
      initial: "start" as StepId,
      shape: { type: "graph" },
      context: { count: 7 },
      steps: {
        start: {},
        details: {},
        review: {}
      },
      options: {
        key: "journey:legacy-current",
        storage,
        deserialize: () => ({
          version: 1,
          snapshot: {
            current: "details",
            timeline: ["start", "details"],
            context: { count: undefined },
            visited: ["start", "details"]
          }
        })
      }
    });

    const hydrated = controller.hydrateSnapshot();
    expect(hydrated.currentStepId).toBe("start");
    expect(hydrated.context).toEqual({ count: 7 });
    expect((controller.inspectPersistedState().lastError as Error).message).toContain(
      "JSON-serializable"
    );
  });

  it("inspects custom-deserialized circular persisted state safely", () => {
    const circular: Record<string, unknown> = { value: "stored" };
    circular.self = circular;
    const storage: JourneyStorage = {
      getItem: vi.fn(() => "circular"),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };

    const controller = createPersistenceController({
      initial: "start" as StepId,
      shape: { type: "graph" },
      context: { count: 0 },
      steps: {
        start: {},
        details: {},
        review: {}
      },
      options: {
        key: "journey:circular-inspect",
        storage,
        deserialize: () => circular
      }
    });

    expect(controller.inspectPersistedState().storedValue).toEqual({
      value: "stored",
      self: "[Circular]"
    });
  });
});
