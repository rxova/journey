import { describe, expect, it, vi } from "vitest";
import {
  createGraphJourney,
  createHeadlessJourney,
  createJourneyMachine,
  createLinearJourney,
  toGraphDefinition,
  toGraphSnapshot,
  JourneyDefinitionError
} from "@rxova/journey-core";
import { createPersistencePlugin } from "@rxova/journey-core/persistence";
import type { JourneyStorage } from "@rxova/journey-core/persistence";
import type { LinearJourneyDefinition, LinearJourneySnapshot } from "@rxova/journey-core";

type Context = { count: number };
type StepId = "a" | "b" | "c";

const linearDefinition: LinearJourneyDefinition<Context, StepId> = {
  context: { count: 0 },
  steps: ["a", "b", "c"]
};

const createMemoryStorage = () => {
  const store = new Map<string, string>();
  const storage: JourneyStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key)
  };
  return { store, storage };
};

// ─── Snapshot `type` discriminator ──────────────────────────────────────────

describe("snapshot family discriminator", () => {
  it("linear machines emit type 'linear' with the authoritative stepOrder", async () => {
    const machine = createLinearJourney(linearDefinition);
    const snapshot = machine.getSnapshot();

    expect(snapshot.type).toBe("linear");
    if (snapshot.type === "linear") {
      expect(snapshot.stepOrder).toEqual(["a", "b", "c"]);
    }

    await machine.startJourney();
    const next = (await machine.goToNextStep()).snapshot;
    expect(next.type).toBe("linear");
    if (next.type === "linear") {
      expect(next.stepOrder).toEqual(["a", "b", "c"]);
    }
  });

  it("graph machines emit type 'graph' without stepOrder", () => {
    const machine = createGraphJourney<Context, "a" | "b">({
      initial: "a",
      context: { count: 0 },
      steps: { a: {}, b: {} },
      transitions: { a: { goToNextStep: [{ to: "b" }] } }
    });

    const snapshot = machine.getSnapshot();
    expect(snapshot.type).toBe("graph");
    expect("stepOrder" in snapshot).toBe(false);
  });

  it("headless machines emit type 'graph'", () => {
    const machine = createHeadlessJourney<Context, "a" | "b">({
      initial: "a",
      context: { count: 0 },
      steps: { a: {}, b: {} }
    });

    expect(machine.getSnapshot().type).toBe("graph");
  });

  it("the discriminator survives navigation, reset, context updates, and terminal transitions", async () => {
    const machine = createLinearJourney(linearDefinition);
    await machine.startJourney();
    await machine.goToNextStep();
    await machine.goToPreviousStep();
    await machine.updateContext((context) => ({ count: context.count + 1 }));
    expect(machine.getSnapshot().type).toBe("linear");

    const completed = await machine.completeJourney();
    expect(completed.snapshot.type).toBe("linear");

    const reset = await machine.resetJourney();
    expect(reset.type).toBe("linear");
  });

  it("persists the discriminator in the stored envelope", async () => {
    const { store, storage } = createMemoryStorage();
    const machine = createLinearJourney(linearDefinition, {
      plugins: [createPersistencePlugin<Context, StepId>({ key: "family", storage })]
    });

    await machine.startJourney();
    await machine.goToNextStep();

    const persisted = JSON.parse(store.get("family") ?? "{}") as {
      snapshot: { type?: string; stepOrder?: string[] };
    };
    expect(persisted.snapshot.type).toBe("linear");
    expect(persisted.snapshot.stepOrder).toEqual(["a", "b", "c"]);
  });

  it("coerces a stored envelope with a mismatched type to the machine's shape and rewrites it", async () => {
    const { store, storage } = createMemoryStorage();
    store.set(
      "family:mismatch",
      JSON.stringify({
        version: 1,
        snapshot: {
          type: "graph",
          currentStepId: "b",
          history: { timeline: ["a", "b"], index: 1 },
          context: { count: 7 },
          visited: { a: true, b: true, c: false },
          status: "running"
        }
      })
    );

    const machine = createLinearJourney(linearDefinition, {
      plugins: [createPersistencePlugin<Context, StepId>({ key: "family:mismatch", storage })]
    });

    // Base state hydrates fine (base fields are compatible across families)…
    const snapshot = machine.getSnapshot();
    expect(snapshot.currentStepId).toBe("b");
    expect(snapshot.type).toBe("linear");

    // …and the stored value is rewritten with the machine's authoritative shape.
    const rewritten = JSON.parse(store.get("family:mismatch") ?? "{}") as {
      snapshot: { type?: string; stepOrder?: string[] };
    };
    expect(rewritten.snapshot.type).toBe("linear");
    expect(rewritten.snapshot.stepOrder).toEqual(["a", "b", "c"]);
  });
});

// ─── pauseJourney / resumeJourney ────────────────────────────────────────────

describe("pauseJourney / resumeJourney", () => {
  it("holds navigation as a no-op with noOpReason 'paused' and resumes cleanly", async () => {
    const machine = createLinearJourney(linearDefinition);
    await machine.startJourney();

    expect(machine.isPaused()).toBe(false);
    machine.pauseJourney();
    expect(machine.isPaused()).toBe(true);

    const next = await machine.goToNextStep();
    expect(next.transitioned).toBe(false);
    expect(next.noOpReason).toBe("paused");
    expect(machine.getSnapshot().currentStepId).toBe("a");

    const previous = await machine.goToPreviousStep();
    expect(previous.noOpReason).toBe("paused");
    const lastVisited = await machine.goToLastVisitedStep();
    expect(lastVisited.noOpReason).toBe("paused");
    const completed = await machine.completeJourney();
    expect(completed.noOpReason).toBe("paused");
    expect(machine.getSnapshot().status).toBe("running");

    machine.resumeJourney();
    expect(machine.isPaused()).toBe(false);
    const resumed = await machine.goToNextStep();
    expect(resumed.transitioned).toBe(true);
    expect(resumed.snapshot.currentStepId).toBe("b");
    expect(resumed.noOpReason).toBeUndefined();
  });

  it("keeps updateContext, clearStepError, and resetJourney working while paused", async () => {
    const machine = createLinearJourney(linearDefinition);
    await machine.startJourney();
    machine.pauseJourney();

    const updated = await machine.updateContext((context) => ({ count: context.count + 5 }));
    expect(updated.context.count).toBe(5);

    await machine.clearStepError();

    const reset = await machine.resetJourney();
    expect(reset.status).toBe("idled");
    // Pause is independent of snapshot state: reset does not clear it.
    expect(machine.isPaused()).toBe(true);
  });

  it("emits journey.paused / journey.resumed observation events", async () => {
    const machine = createLinearJourney(linearDefinition);
    await machine.startJourney();

    const events: string[] = [];
    machine.subscribeEvent((event) => {
      if (event.type === "journey.paused" || event.type === "journey.resumed") {
        events.push(event.type);
      }
    });

    machine.pauseJourney();
    machine.pauseJourney(); // idempotent: no duplicate event
    machine.resumeJourney();
    machine.resumeJourney(); // idempotent

    expect(events).toEqual(["journey.paused", "journey.resumed"]);
  });

  it("pause is never part of the snapshot or the persisted envelope", async () => {
    const { store, storage } = createMemoryStorage();
    const machine = createLinearJourney(linearDefinition, {
      plugins: [createPersistencePlugin<Context, StepId>({ key: "family:pause", storage })]
    });
    await machine.startJourney();
    machine.pauseJourney();
    await machine.updateContext((context) => ({ count: context.count + 1 }));

    expect("isPaused" in machine.getSnapshot()).toBe(false);
    const persisted = JSON.parse(store.get("family:pause") ?? "{}") as {
      snapshot: Record<string, unknown>;
    };
    expect("isPaused" in persisted.snapshot).toBe(false);
    expect("paused" in persisted.snapshot).toBe(false);
  });

  it("warns and no-ops on a disposed machine", () => {
    const machine = createLinearJourney(linearDefinition);
    machine.dispose();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    machine.pauseJourney();
    machine.resumeJourney();
    expect(machine.isPaused()).toBe(false);
    warn.mockRestore();
  });
});

// ─── initialSnapshot option ──────────────────────────────────────────────────

describe("initialSnapshot machine option", () => {
  it("starts the machine from the given snapshot state, preserving status", async () => {
    const machine = createLinearJourney(linearDefinition, {
      initialSnapshot: {
        currentStepId: "b",
        history: { timeline: ["a", "b"], index: 1 },
        context: { count: 3 },
        visited: { a: true, b: true, c: false },
        status: "running"
      }
    });

    const snapshot = machine.getSnapshot();
    expect(snapshot.currentStepId).toBe("b");
    expect(snapshot.status).toBe("running");
    expect(snapshot.context).toEqual({ count: 3 });
    expect(snapshot.visited).toEqual({ a: true, b: true, c: false });
    expect(snapshot.type).toBe("linear");

    // The machine is live from the transplanted state — no startJourney needed.
    const next = await machine.goToNextStep();
    expect(next.snapshot.currentStepId).toBe("c");
    expect(next.snapshot.history.timeline).toEqual(["a", "b", "c"]);
  });

  it("stamps the machine's own shape and rebuilds async state fresh", () => {
    const machine = createGraphJourney<Context, "a" | "b">(
      {
        initial: "a",
        context: { count: 0 },
        steps: { a: {}, b: {} },
        transitions: { a: { goToNextStep: [{ to: "b" }] } }
      },
      {
        initialSnapshot: {
          // A linear-family value being transplanted into a graph machine:
          // toGraphSnapshot is the intended path, but stray extras are ignored.
          currentStepId: "b",
          history: { timeline: ["a", "b"], index: 1 },
          context: { count: 1 },
          visited: { a: true, b: true },
          status: "idled"
        }
      }
    );

    const snapshot = machine.getSnapshot();
    expect(snapshot.type).toBe("graph");
    expect("stepOrder" in snapshot).toBe(false);
    expect(snapshot.async.isLoading).toBe(false);
  });

  it("rejects timelines referencing unknown steps", () => {
    expect(() =>
      createLinearJourney(linearDefinition, {
        initialSnapshot: {
          currentStepId: "nope",
          history: { timeline: ["a", "nope"], index: 1 },
          context: { count: 0 },
          visited: {},
          status: "running"
        }
      })
    ).toThrowError(JourneyDefinitionError);
  });

  it("rejects invalid status values and empty timelines", () => {
    expect(() =>
      createLinearJourney(linearDefinition, {
        initialSnapshot: {
          currentStepId: "a",
          history: { timeline: [], index: 0 },
          context: { count: 0 },
          visited: {},
          status: "running"
        }
      })
    ).toThrowError(JourneyDefinitionError);

    expect(() =>
      createLinearJourney(linearDefinition, {
        initialSnapshot: {
          currentStepId: "a",
          history: { timeline: ["a"], index: 0 },
          context: { count: 0 },
          visited: {},
          status: "paused" as never
        }
      })
    ).toThrowError(JourneyDefinitionError);
  });

  it("persistence hydration still wins over initialSnapshot when storage has data", () => {
    const { store, storage } = createMemoryStorage();
    store.set(
      "family:layering",
      JSON.stringify({
        version: 1,
        snapshot: {
          type: "linear",
          stepOrder: ["a", "b", "c"],
          currentStepId: "c",
          history: { timeline: ["a", "b", "c"], index: 2 },
          context: { count: 99 },
          visited: { a: true, b: true, c: true },
          status: "running"
        }
      })
    );

    const machine = createLinearJourney(linearDefinition, {
      initialSnapshot: {
        currentStepId: "b",
        history: { timeline: ["a", "b"], index: 1 },
        context: { count: 1 },
        visited: { a: true, b: true },
        status: "running"
      },
      plugins: [createPersistencePlugin<Context, StepId>({ key: "family:layering", storage })]
    });

    const snapshot = machine.getSnapshot();
    expect(snapshot.currentStepId).toBe("c");
    expect(snapshot.context).toEqual({ count: 99 });
    // Persistence downgrades a stored "running" status to "idled".
    expect(snapshot.status).toBe("idled");
  });
});

// ─── toGraphDefinition / toGraphSnapshot ─────────────────────────────────────

describe("toGraphDefinition", () => {
  it("emits an equivalent graph definition with the same step ids and forward chain", async () => {
    const entered: string[] = [];
    const linear: LinearJourneyDefinition<Context, StepId> = {
      context: { count: 0 },
      steps: ["a", { id: "b", meta: { label: "B" }, onEnter: () => void entered.push("b") }, "c"]
    };

    const graphDefinition = toGraphDefinition(linear);
    expect(graphDefinition.initial).toBe("a");
    expect(Object.keys(graphDefinition.steps)).toEqual(["a", "b", "c"]);
    expect(graphDefinition.steps.b.meta).toEqual({ label: "B" });

    const machine = createJourneyMachine(graphDefinition);
    await machine.startJourney();

    const toB = await machine.goToNextStep();
    expect(toB.snapshot.currentStepId).toBe("b");
    expect(entered).toEqual(["b"]);

    const toC = await machine.goToNextStep();
    expect(toC.snapshot.currentStepId).toBe("c");

    // Backward navigation is history-based — no explicit edges needed.
    const back = await machine.goToPreviousStep();
    expect(back.snapshot.currentStepId).toBe("b");
    await machine.goToLastVisitedStep();

    // Last step: goToNextStep completes via the implicit-completion fallback,
    // matching linear semantics.
    const done = await machine.goToNextStep();
    expect(done.snapshot.status).toBe("completed");
  });

  it("the emitted definition produces graph-family snapshots", () => {
    const machine = createJourneyMachine(toGraphDefinition(linearDefinition));
    expect(machine.getSnapshot().type).toBe("graph");
  });
});

describe("toGraphSnapshot", () => {
  it("flips the discriminator and drops stepOrder, keeping base fields verbatim", async () => {
    const machine = createLinearJourney(linearDefinition);
    await machine.startJourney();
    await machine.goToNextStep();

    const linearSnapshot = machine.getSnapshot() as LinearJourneySnapshot<Context, StepId>;
    const graphSnapshot = toGraphSnapshot(linearSnapshot);

    expect(graphSnapshot.type).toBe("graph");
    expect("stepOrder" in graphSnapshot).toBe(false);
    expect(graphSnapshot.currentStepId).toBe(linearSnapshot.currentStepId);
    expect(graphSnapshot.history).toEqual(linearSnapshot.history);
    expect(graphSnapshot.visited).toEqual(linearSnapshot.visited);
    expect(graphSnapshot.context).toEqual(linearSnapshot.context);
    expect(graphSnapshot.status).toBe(linearSnapshot.status);
  });

  it("round-trips a live linear snapshot into a graph machine via initialSnapshot", async () => {
    const linearMachine = createLinearJourney(linearDefinition);
    await linearMachine.startJourney();
    await linearMachine.goToNextStep();
    await linearMachine.updateContext(() => ({ count: 42 }));

    const migrated = toGraphSnapshot(
      linearMachine.getSnapshot() as LinearJourneySnapshot<Context, StepId>
    );

    const graphMachine = createJourneyMachine(toGraphDefinition(linearDefinition), {
      initialSnapshot: migrated
    });

    const snapshot = graphMachine.getSnapshot();
    expect(snapshot.type).toBe("graph");
    expect(snapshot.currentStepId).toBe("b");
    expect(snapshot.context).toEqual({ count: 42 });
    expect(snapshot.history.timeline).toEqual(["a", "b"]);
    expect(snapshot.status).toBe("running");

    const next = await graphMachine.goToNextStep();
    expect(next.snapshot.currentStepId).toBe("c");
  });
});
