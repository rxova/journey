import { describe, expect, it } from "vitest";

import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "s0" | "s1";
type Context = { count: number };
type StepMeta = {
  title: string;
  nested: { count: number };
  when: Date;
  flags: Map<string, boolean>;
};

const createJourney = (
  overrides?: Partial<JourneyDefinition<Context, StepId, never, StepMeta>>
): JourneyDefinition<Context, StepId, never, StepMeta> => ({
  initial: "s0",
  context: { count: 0 },
  steps: {
    s0: {
      meta: {
        title: "Start",
        nested: { count: 1 },
        when: new Date("2024-01-01T00:00:00.000Z"),
        flags: new Map([["start", true]])
      }
    },
    s1: {}
  },
  transitions: {
    s0: {
      goToNextStep: [{ to: "s1" }]
    },
    s1: {
      completeJourney: [{}]
    }
  },
  ...overrides
});

describe("lifecycle safety", () => {
  it("aborts in-flight lifecycle callbacks when resetJourney invalidates the run", async () => {
    let signalRef: AbortSignal | null = null;
    let resolveStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });

    const machine = createJourneyMachine(
      createJourney({
        steps: {
          s0: {},
          s1: {
            onEnter: async ({ signal }) => {
              signalRef = signal;
              resolveStarted();
              await new Promise<void>((resolve) => {
                signal.addEventListener("abort", () => resolve(), { once: true });
              });
            }
          }
        }
      })
    );

    await machine.controls.start();
    await machine.goToNextStep();
    await started;
    expect(signalRef).not.toBeNull();
    expect(signalRef!.aborted).toBe(false);

    await machine.controls.reset();

    expect(signalRef!.aborted).toBe(true);
  });

  it("aborts in-flight lifecycle callbacks when the machine is disposed", async () => {
    let signalRef: AbortSignal | null = null;
    let resolveStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });

    const machine = createJourneyMachine(
      createJourney({
        steps: {
          s0: {},
          s1: {
            onEnter: async ({ signal }) => {
              signalRef = signal;
              resolveStarted();
              await new Promise<void>((resolve) => {
                signal.addEventListener("abort", () => resolve(), { once: true });
              });
            }
          }
        }
      })
    );

    await machine.controls.start();
    await machine.goToNextStep();
    await started;
    expect(signalRef).not.toBeNull();
    expect(signalRef!.aborted).toBe(false);

    machine.dispose();

    expect(signalRef!.aborted).toBe(true);
  });

  it("returns detached step metadata snapshots", () => {
    const definition = createJourney();
    const machine = createJourneyMachine(definition);

    const initialMeta = machine.getStepMeta("s0");
    if (!initialMeta) {
      throw new Error("Expected step meta for s0.");
    }

    const definitionMeta = definition.steps.s0.meta;
    if (!definitionMeta) {
      throw new Error("Expected definition step meta for s0.");
    }

    definitionMeta.nested.count = 99;
    definitionMeta.when.setUTCFullYear(2035);
    definitionMeta.flags.set("definition", true);

    initialMeta.nested.count = 7;
    initialMeta.when.setUTCFullYear(2040);
    initialMeta.flags.set("returned", true);

    const freshMeta = machine.getStepMeta("s0");
    if (!freshMeta) {
      throw new Error("Expected step meta for s0.");
    }

    expect(freshMeta).not.toBe(initialMeta);
    expect(freshMeta.nested.count).toBe(1);
    expect(freshMeta.when.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    expect([...freshMeta.flags.entries()]).toEqual([["start", true]]);
  });
});
