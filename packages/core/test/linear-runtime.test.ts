import { describe, expect, it } from "vitest";
import {
  createLinearJourney,
  deriveLinearTransplantSnapshot,
  JourneyDefinitionError
} from "@rxova/journey-core";
import { createPersistencePlugin } from "@rxova/journey-core/persistence";
import type { JourneyStorage } from "@rxova/journey-core/persistence";
import type { LinearJourneySnapshot } from "@rxova/journey-core";

type Ctx = { count: number };
type StepId = "a" | "b" | "c" | "d";

const definition = {
  context: { count: 0 } as Ctx,
  steps: ["a", "b", "c", "d"] as const
};

const createMachine = () => createLinearJourney<Ctx, StepId>(definition);

const linearSnapshot = (machine: ReturnType<typeof createMachine>) =>
  machine.getSnapshot() as LinearJourneySnapshot<Ctx, StepId>;

describe("linear runtime navigation", () => {
  it("supports arbitrary forward jumps via goToStepById (no graph edges needed)", async () => {
    const machine = createMachine();
    await machine.controls.start();

    const jump = await machine.goToStepById("d");
    expect(jump.transitioned).toBe(true);
    expect(jump.snapshot.currentStepId).toBe("d");
    expect(jump.snapshot.history.timeline).toEqual(["a", "d"]);
  });

  it("goToStepByIndex: +1 advances, backward walks history, larger jumps go direct", async () => {
    const machine = createMachine();
    await machine.controls.start();

    await machine.goToStepByIndex(1); // next
    expect(machine.getSnapshot().currentStepId).toBe("b");

    const bigJump = await machine.goToStepByIndex(3);
    expect(bigJump.transitioned).toBe(true);
    expect(bigJump.snapshot.currentStepId).toBe("d");

    const back = await machine.goToStepByIndex(1);
    expect(back.snapshot.currentStepId).toBe("b");
    // Backward routes through history navigation (index moves; no append).
    expect(back.snapshot.history.timeline).toEqual(["a", "b", "d"]);
  });

  it("tracks visits on every entry, including backward navigation", async () => {
    const machine = createMachine();
    await machine.controls.start();
    expect(linearSnapshot(machine).visits).toEqual({ a: 1, b: 0, c: 0, d: 0 });
    expect((machine.getComputed() as { isStepFirstTimeVisit?: boolean }).isStepFirstTimeVisit).toBe(
      true
    );

    await machine.goToNextStep();
    await machine.goToPreviousStep();
    const snapshot = linearSnapshot(machine);
    expect(snapshot.visits.a).toBe(2);
    expect(snapshot.visits.b).toBe(1);
    expect(snapshot.visited).toEqual({ a: true, b: true, c: false, d: false });
    expect((machine.getComputed() as { isStepFirstTimeVisit?: boolean }).isStepFirstTimeVisit).toBe(
      false
    );
  });

  it("supports initial and startIndex in the definition", async () => {
    const byInitial = createLinearJourney<Ctx, StepId>({ ...definition, initial: "c" });
    expect(byInitial.getSnapshot().currentStepId).toBe("c");
    expect(byInitial.getComputed().isFirstStep).toBe(false);

    const byIndex = createLinearJourney<Ctx, StepId>({ ...definition, startIndex: 1 });
    expect(byIndex.getSnapshot().currentStepId).toBe("b");

    expect(() =>
      createLinearJourney<Ctx, StepId>({ ...definition, initial: "nope" as StepId })
    ).toThrowError(JourneyDefinitionError);
    expect(() => createLinearJourney<Ctx, StepId>({ ...definition, startIndex: 99 })).toThrowError(
      JourneyDefinitionError
    );
  });
});

describe("linear runtime next-step interceptors", () => {
  it("awaits interceptors before advancing and can update context", async () => {
    const machine = createMachine();
    await machine.controls.start();

    const unregister = machine.registerNextStepInterceptor("a", async ({ updateContext }) => {
      await updateContext((context) => ({ count: context.count + 1 }));
    });

    const result = await machine.goToNextStep();
    expect(result.transitioned).toBe(true);
    expect(result.snapshot.currentStepId).toBe("b");
    expect(machine.getSnapshot().context.count).toBe(1);

    unregister();
    await machine.goToPreviousStep();
    await machine.goToNextStep();
    expect(machine.getSnapshot().context.count).toBe(1); // no longer intercepted
  });

  it("a rejecting interceptor cancels navigation and reports through async state", async () => {
    const machine = createMachine();
    await machine.controls.start();
    const errors: unknown[] = [];
    machine.subscribeEvent((event) => {
      if (event.type === "transition.error") {
        errors.push(event.transitionId);
      }
    });

    machine.registerNextStepInterceptor("a", () => {
      throw new Error("blocked");
    });

    const result = await machine.goToNextStep();
    expect(result.transitioned).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect(machine.getSnapshot().currentStepId).toBe("a");
    expect(machine.getSnapshot().async.byStep.a.phase).toBe("error");
    expect(errors).toEqual(["next-interceptor"]);
  });
});

describe("deriveLinearTransplantSnapshot", () => {
  it("filters state to surviving steps and preserves visits", async () => {
    const machine = createMachine();
    await machine.controls.start();
    await machine.goToNextStep(); // a → b
    await machine.goToNextStep(); // b → c
    await machine.goToPreviousStep(); // back to b

    const transplant = deriveLinearTransplantSnapshot(linearSnapshot(machine), [
      "a",
      "b",
      "d"
    ] as readonly StepId[]);
    expect(transplant).toBeDefined();
    expect(transplant?.currentStepId).toBe("b");
    expect(transplant?.history.timeline).toEqual(["a", "b"]);
    expect(transplant?.visits).toEqual({ a: 1, b: 2, d: 0 });
    expect(transplant?.status).toBe("running");

    expect(transplant).toBeDefined();
    const next = createLinearJourney<Ctx, "a" | "b" | "d">(
      { context: { count: 0 }, steps: ["a", "b", "d"] },
      { initialSnapshot: transplant! }
    );
    const snapshot = next.getSnapshot() as LinearJourneySnapshot<Ctx, "a" | "b" | "d">;
    expect(snapshot.currentStepId).toBe("b");
    expect(snapshot.visits).toEqual({ a: 1, b: 2, d: 0 });
    expect(snapshot.status).toBe("running");
  });

  it("returns undefined when nothing survives", async () => {
    const machine = createMachine();
    await machine.controls.start();
    expect(
      deriveLinearTransplantSnapshot(linearSnapshot(machine), [
        "x",
        "y"
      ] as unknown as readonly StepId[])
    ).toBeUndefined();
  });
});

describe("linear runtime persistence of visits", () => {
  const createMemoryStorage = () => {
    const store = new Map<string, string>();
    const storage: JourneyStorage = {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => void store.set(key, value),
      removeItem: (key) => void store.delete(key)
    };
    return { store, storage };
  };

  it("persists visits and restores them on hydrate", async () => {
    const { store, storage } = createMemoryStorage();
    const machine = createLinearJourney(definition, {
      plugins: [createPersistencePlugin<Ctx, StepId>({ key: "lin", storage })] as const
    });
    await machine.controls.start();
    await machine.goToNextStep();
    await machine.goToPreviousStep();
    machine.dispose();

    const persisted = JSON.parse(store.get("lin") ?? "{}") as {
      snapshot: { visits?: Record<string, number> };
    };
    expect(persisted.snapshot.visits).toEqual({ a: 2, b: 1, c: 0, d: 0 });

    const restored = createLinearJourney(definition, {
      plugins: [createPersistencePlugin<Ctx, StepId>({ key: "lin", storage })] as const
    });
    const snapshot = restored.getSnapshot() as LinearJourneySnapshot<Ctx, StepId>;
    expect(snapshot.visits).toEqual({ a: 2, b: 1, c: 0, d: 0 });
    expect(
      (restored.getComputed() as { isStepFirstTimeVisit?: boolean }).isStepFirstTimeVisit
    ).toBe(false);
  });

  it("derives visits from the timeline for old envelopes without counts", async () => {
    const { store, storage } = createMemoryStorage();
    store.set(
      "lin:old",
      JSON.stringify({
        version: 1,
        snapshot: {
          type: "linear",
          stepOrder: ["a", "b", "c", "d"],
          currentStepId: "b",
          history: { timeline: ["a", "b"], index: 1 },
          context: { count: 3 },
          visited: { a: true, b: true, c: false, d: false },
          status: "running"
        }
      })
    );

    const machine = createLinearJourney(definition, {
      plugins: [createPersistencePlugin<Ctx, StepId>({ key: "lin:old", storage })] as const
    });
    const snapshot = machine.getSnapshot() as LinearJourneySnapshot<Ctx, StepId>;
    expect(snapshot.visits).toEqual({ a: 1, b: 1, c: 0, d: 0 });
    // The envelope is rewritten in the new format.
    const rewritten = JSON.parse(store.get("lin:old") ?? "{}") as {
      snapshot: { visits?: Record<string, number> };
    };
    expect(rewritten.snapshot.visits).toEqual({ a: 1, b: 1, c: 0, d: 0 });
  });
});
