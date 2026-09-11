import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { createGraphJourney, createLinearJourney } from "@rxova/journey-core";
import { flush, wait } from "@rxova/journey-core/testing";
import type { JourneySnapshot } from "@rxova/journey-core";

type Ctx = { n: number };

const linearDefinition = { steps: ["a", "b", "c", "d"], context: { n: 0 } as Ctx } as const;

const graphDefinition = {
  steps: { a: {}, b: {}, c: {}, d: {} },
  transitions: {
    NEXT: [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "c", to: "d" }
    ],
    BRANCH: [
      { from: "b", to: "d", when: ({ context }: { context: Ctx }) => context.n % 2 === 0 },
      { from: "b", to: "c" }
    ],
    SELF: { from: "a", to: "a" }
  },
  initial: "a",
  context: { n: 0 } as Ctx
} as const;

type Op =
  | { kind: "start" }
  | { kind: "pause" }
  | { kind: "resume" }
  | { kind: "complete" }
  | { kind: "terminate" }
  | { kind: "restart" }
  | { kind: "next" }
  | { kind: "prev"; n: number }
  | { kind: "byId"; id: "a" | "b" | "c" | "d" }
  | { kind: "byIndex"; index: number }
  | { kind: "last" }
  | { kind: "update" }
  | { kind: "send"; event: "NEXT" | "BRANCH" | "SELF" };

const opArbitrary = fc.oneof(
  fc.constant<Op>({ kind: "start" }),
  fc.constant<Op>({ kind: "pause" }),
  fc.constant<Op>({ kind: "resume" }),
  fc.constant<Op>({ kind: "complete" }),
  fc.constant<Op>({ kind: "terminate" }),
  fc.constant<Op>({ kind: "restart" }),
  fc.constant<Op>({ kind: "next" }),
  fc.record({ kind: fc.constant("prev" as const), n: fc.integer({ min: 1, max: 3 }) }),
  fc.record({
    kind: fc.constant("byId" as const),
    id: fc.constantFrom("a" as const, "b" as const, "c" as const, "d" as const)
  }),
  fc.record({ kind: fc.constant("byIndex" as const), index: fc.integer({ min: -1, max: 5 }) }),
  fc.constant<Op>({ kind: "last" }),
  fc.constant<Op>({ kind: "update" }),
  fc.record({
    kind: fc.constant("send" as const),
    event: fc.constantFrom("NEXT" as const, "BRANCH" as const, "SELF" as const)
  })
);

const sequenceArbitrary = fc.array(opArbitrary, { minLength: 1, maxLength: 25 });

type FuzzMachine = {
  getSnapshot(): JourneySnapshot;
  controls: {
    start(): boolean;
    pause(): boolean;
    resume(): boolean;
    complete(payload?: unknown): boolean;
    terminate(payload?: unknown): boolean;
    restart(): boolean;
  };
  navigate: {
    goToNextStep(): Promise<unknown>;
    goToPreviousStep(n?: number): Promise<unknown>;
    goToStepById(id: never): Promise<unknown>;
    goToLastVisitedStep(): Promise<unknown>;
    goToStepByIndex?(index: number): Promise<unknown>;
  };
  context: { update(updater: (previous: Ctx) => Ctx): void };
  send?(event: never): Promise<unknown>;
};

async function apply(machine: FuzzMachine, op: Op): Promise<void> {
  switch (op.kind) {
    case "start":
      machine.controls.start();
      break;
    case "pause":
      machine.controls.pause();
      break;
    case "resume":
      machine.controls.resume();
      break;
    case "complete":
      machine.controls.complete();
      break;
    case "terminate":
      machine.controls.terminate();
      break;
    case "restart":
      machine.controls.restart();
      break;
    case "next":
      await machine.navigate.goToNextStep();
      break;
    case "prev":
      await machine.navigate.goToPreviousStep(op.n);
      break;
    case "byId":
      await machine.navigate.goToStepById(op.id as never);
      break;
    case "byIndex":
      await machine.navigate.goToStepByIndex?.(op.index);
      break;
    case "last":
      await machine.navigate.goToLastVisitedStep();
      break;
    case "update":
      machine.context.update((previous) => ({ n: previous.n + 1 }));
      break;
    case "send":
      await machine.send?.(op.event as never);
      break;
  }
  await flush();
}

function assertInvariants(snapshot: JourneySnapshot): void {
  const { timeline, currentIndex, canGoBack, canGoForward, visited } = snapshot.history;

  expect(currentIndex).toBeGreaterThanOrEqual(-1);
  expect(currentIndex).toBeLessThan(Math.max(timeline.length, 1));
  if (timeline.length === 0) expect(currentIndex).toBe(-1);
  expect(canGoBack).toBe(currentIndex > 0);
  expect(canGoForward).toBe(currentIndex >= 0 && currentIndex < timeline.length - 1);

  expect(["idle", "running", "paused", "completed", "terminated"]).toContain(snapshot.status);
  expect(snapshot.machine.isIdle).toBe(snapshot.status === "idle");
  expect(snapshot.machine.isRunning).toBe(snapshot.status === "running");
  expect(snapshot.machine.isPaused).toBe(snapshot.status === "paused");
  expect(snapshot.machine.isCompleted).toBe(snapshot.status === "completed");
  expect(snapshot.machine.isTerminated).toBe(snapshot.status === "terminated");

  if (snapshot.status === "idle") {
    expect(snapshot.currentStep).toBeNull();
  }
  if (snapshot.currentStep) {
    expect(snapshot.currentStep.id).toBe(timeline[currentIndex]);
    expect(visited[snapshot.currentStep.id as keyof typeof visited]).toBe(true);
  }
}

describe("determinism fuzz", () => {
  it("the same linear command sequence always produces the same snapshot", async () => {
    await fc.assert(
      fc.asyncProperty(sequenceArbitrary, async (ops) => {
        const first = createLinearJourney(linearDefinition) as unknown as FuzzMachine;
        const second = createLinearJourney(linearDefinition) as unknown as FuzzMachine;
        for (const op of ops) {
          await apply(first, op);
          assertInvariants(first.getSnapshot());
        }
        for (const op of ops) {
          await apply(second, op);
        }
        expect(second.getSnapshot()).toEqual(first.getSnapshot());
      }),
      { numRuns: 40 }
    );
  });

  it("the same graph command sequence always produces the same snapshot", async () => {
    await fc.assert(
      fc.asyncProperty(sequenceArbitrary, async (ops) => {
        const first = createGraphJourney(graphDefinition) as unknown as FuzzMachine;
        const second = createGraphJourney(graphDefinition) as unknown as FuzzMachine;
        for (const op of ops) {
          await apply(first, op);
          assertInvariants(first.getSnapshot());
        }
        for (const op of ops) {
          await apply(second, op);
        }
        expect(second.getSnapshot()).toEqual(first.getSnapshot());
      }),
      { numRuns: 40 }
    );
  });

  it("slow work raced against terminate/restart never commits stale state", async () => {
    const raceOp = fc.constantFrom("terminate" as const, "restart" as const, "none" as const);
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 2 }),
        raceOp,
        fc.boolean(),
        async (delayMs, interrupt, updateDuringWork) => {
          const machine = createGraphJourney(graphDefinition);
          machine.controls.start();
          await flush();

          const pendingSend = machine.send("NEXT", {
            run: async () => {
              await wait(delayMs);
              return "done";
            },
            commit: ({ updateContext }) => {
              if (updateDuringWork) updateContext((previous) => ({ n: previous.n + 10 }));
            }
          });

          if (interrupt === "terminate") machine.controls.terminate();
          if (interrupt === "restart") {
            machine.controls.terminate();
            machine.controls.restart();
          }

          await pendingSend;
          await flush();
          await wait(3);

          const snapshot = machine.getSnapshot();
          assertInvariants(snapshot);
          if (interrupt === "terminate") {
            expect(snapshot.status).toBe("terminated");
            // A stale work commit must not have advanced the journey off "a".
            expect(snapshot.currentStep?.id).toBe("a");
            expect((snapshot.context as Ctx).n).toBe(0);
          }
          if (interrupt === "restart") {
            expect(snapshot.status).toBe("running");
            expect(snapshot.currentStep?.id).toBe("a");
            expect((snapshot.context as Ctx).n).toBe(0);
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});
