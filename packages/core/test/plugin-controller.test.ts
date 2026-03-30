import { describe, expect, it, vi } from "vitest";

import { buildInitialAsyncState } from "../src/journey-machine/helpers";
import { createJourneyMachinePluginController } from "../src/journey-machine/plugin-controller";
import { resolveJourneyDefinition } from "../src/journey-machine/resolve-journey-definition";
import type { JourneyMachinePluginHooks } from "../src/types";

import type {
  JourneyDefinition,
  JourneyMachine,
  JourneyMachinePlugin,
  JourneySnapshot
} from "@rxova/journey-core";

type StepId = "start" | "review";
type Context = { count: number };
type StepMeta = { title: string };
type Snapshot = JourneySnapshot<Context, StepId>;

const journey: JourneyDefinition<Context, StepId, Record<never, never>, StepMeta> = {
  initial: "start",
  context: { count: 0 },
  steps: {
    start: { meta: { title: "Start" } },
    review: { meta: { title: "Review" } }
  },
  transitions: {
    start: {
      goToNextStep: [{ to: "review" }]
    }
  }
};

const resolvedJourney = resolveJourneyDefinition(journey);

const buildInitialSnapshot = (): Snapshot => ({
  currentStepId: "start",
  history: {
    timeline: ["start"],
    index: 0
  },
  context: { count: 0 },
  visited: { start: true, review: false },
  status: "idled",
  async: buildInitialAsyncState({
    start: {},
    review: {}
  })
});

const createSetupContext = () => ({
  journey,
  resolvedJourney,
  options: {
    requireExplicitCompletion: false,
    defaultTimeoutMs: undefined
  },
  buildInitialSnapshot
});

const createPlugin = (
  name: string,
  hooks: JourneyMachinePluginHooks<Context, StepId, Record<never, never>, StepMeta>
): JourneyMachinePlugin => ({
  name,
  setup: (() => hooks) as JourneyMachinePlugin["setup"]
});

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

describe("machine plugin controller", () => {
  it("hydrates snapshots, forwards snapshot change hooks, and disposes plugin hooks", () => {
    const onSnapshotChange = vi.fn();
    const dispose = vi.fn();
    const controller = createJourneyMachinePluginController<
      Context,
      StepId,
      Record<never, never>,
      StepMeta
    >({
      plugins: [
        createPlugin("inspector", {
          hydrateSnapshot: (snapshot: Snapshot) => ({
            ...snapshot,
            context: {
              count: snapshot.context.count + 1
            }
          }),
          onSnapshotChange,
          dispose
        })
      ],
      setupContext: createSetupContext()
    });
    const previousSnapshot = buildInitialSnapshot();
    const hydratedSnapshot = controller.hydrateSnapshot(previousSnapshot);

    expect(hydratedSnapshot.context.count).toBe(1);

    controller.onSnapshotChange({
      previousSnapshot,
      snapshot: hydratedSnapshot,
      reason: "transition"
    });
    controller.dispose();

    expect(onSnapshotChange).toHaveBeenCalledWith({
      previousSnapshot,
      snapshot: hydratedSnapshot,
      reason: "transition"
    });
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("hydrates snapshots in plugin registration order", () => {
    const order: string[] = [];
    const controller = createJourneyMachinePluginController<
      Context,
      StepId,
      Record<never, never>,
      StepMeta
    >({
      plugins: [
        createPlugin("increment", {
          hydrateSnapshot: (snapshot: Snapshot) => {
            order.push("increment");
            return {
              ...snapshot,
              context: {
                count: snapshot.context.count + 1
              }
            };
          }
        }),
        createPlugin("multiply", {
          hydrateSnapshot: (snapshot: Snapshot) => {
            order.push("multiply");
            return {
              ...snapshot,
              context: {
                count: snapshot.context.count * 10
              }
            };
          }
        })
      ],
      setupContext: createSetupContext()
    });

    const hydratedSnapshot = controller.hydrateSnapshot(buildInitialSnapshot());

    expect(order).toEqual(["increment", "multiply"]);
    expect(hydratedSnapshot.context.count).toBe(10);
  });

  it("extends machines and skips plugins that return no extension", () => {
    const controller = createJourneyMachinePluginController<
      Context,
      StepId,
      Record<never, never>,
      StepMeta
    >({
      plugins: [
        {
          name: "noop",
          setup: () => ({
            augmentMachine: () => undefined as unknown as Record<never, never>
          })
        },
        {
          name: "debug-tools",
          setup: () => ({
            augmentMachine: () => ({
              inspect: () => "ok"
            })
          })
        }
      ],
      setupContext: createSetupContext()
    });

    const machine = {
      start: vi.fn()
    } as unknown as JourneyMachine<Context, StepId, Record<never, never>, StepMeta> & {
      inspect?: () => string;
    };
    const extended = controller.extendMachine(machine);

    expect(extended).toBe(machine);
    expect(machine.inspect?.()).toBe("ok");
  });

  it("disposes all plugins even when an earlier dispose throws", () => {
    const dispose1 = vi.fn(() => {
      throw new Error("dispose1 failed");
    });
    const dispose2 = vi.fn();
    const dispose3 = vi.fn();

    const controller = createJourneyMachinePluginController<
      Context,
      StepId,
      Record<never, never>,
      StepMeta
    >({
      plugins: [
        { name: "p1", setup: () => ({ dispose: dispose1 }) },
        { name: "p2", setup: () => ({ dispose: dispose2 }) },
        { name: "p3", setup: () => ({ dispose: dispose3 }) }
      ],
      setupContext: createSetupContext()
    });

    expect(() => controller.dispose()).toThrow("dispose1 failed");
    expect(dispose1).toHaveBeenCalledTimes(1);
    expect(dispose2).toHaveBeenCalledTimes(1);
    expect(dispose3).toHaveBeenCalledTimes(1);
  });

  it("rolls back already-initialized plugins when a later setup fails", () => {
    const rollbackOrder: string[] = [];
    const dispose1 = vi.fn(() => {
      rollbackOrder.push("p1");
    });
    const dispose2 = vi.fn(() => {
      rollbackOrder.push("p2");
      throw new Error("dispose2 failed");
    });

    expect(() =>
      createJourneyMachinePluginController<Context, StepId, Record<never, never>, StepMeta>({
        plugins: [
          { name: "p1", setup: () => ({ dispose: dispose1 }) },
          { name: "p2", setup: () => ({ dispose: dispose2 }) },
          {
            name: "p3",
            setup: () => {
              throw new Error("setup3 failed");
            }
          }
        ],
        setupContext: createSetupContext()
      })
    ).toThrow('Journey plugin "p3" setup failed: setup3 failed');

    expect(rollbackOrder).toEqual(["p2", "p1"]);
    expect(dispose1).toHaveBeenCalledTimes(1);
    expect(dispose2).toHaveBeenCalledTimes(1);
  });

  it("calls all onSnapshotChange hooks even when one throws", () => {
    const onChange1 = vi.fn(() => {
      throw new Error("onChange1 failed");
    });
    const onChange2 = vi.fn();

    const controller = createJourneyMachinePluginController<
      Context,
      StepId,
      Record<never, never>,
      StepMeta
    >({
      plugins: [
        { name: "p1", setup: () => ({ onSnapshotChange: onChange1 }) },
        { name: "p2", setup: () => ({ onSnapshotChange: onChange2 }) }
      ],
      setupContext: createSetupContext()
    });

    const snapshot = buildInitialSnapshot();
    expect(() =>
      controller.onSnapshotChange({
        previousSnapshot: snapshot,
        snapshot,
        reason: "transition"
      })
    ).toThrow("onChange1 failed");
    expect(onChange1).toHaveBeenCalledTimes(1);
    expect(onChange2).toHaveBeenCalledTimes(1);
  });

  it("warns when a plugin returns a Promise from onSnapshotChange", async () => {
    await withNodeEnv("development", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      const controller = createJourneyMachinePluginController<
        Context,
        StepId,
        Record<never, never>,
        StepMeta
      >({
        plugins: [
          {
            name: "async-plugin",
            setup: () => ({
              onSnapshotChange: () => Promise.resolve() as unknown as void
            })
          }
        ],
        setupContext: createSetupContext()
      });

      const snapshot = buildInitialSnapshot();
      controller.onSnapshotChange({ previousSnapshot: snapshot, snapshot, reason: "transition" });

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("async-plugin"));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("onSnapshotChange"));
      warnSpy.mockRestore();
    });
  });

  it("rejects plugins that try to override machine properties", () => {
    const controller = createJourneyMachinePluginController<
      Context,
      StepId,
      Record<never, never>,
      StepMeta
    >({
      plugins: [
        {
          name: "override-plugin",
          setup: () => ({
            augmentMachine: () => ({
              start: vi.fn()
            })
          })
        }
      ],
      setupContext: createSetupContext()
    });

    const machine = {
      start: vi.fn()
    } as unknown as JourneyMachine<Context, StepId, Record<never, never>, StepMeta>;

    expect(() => controller.extendMachine(machine)).toThrow(
      'Journey plugin "override-plugin" cannot override machine property "start".'
    );
  });

  it("rejects plugins that collide with another plugin's extension key", () => {
    const controller = createJourneyMachinePluginController<
      Context,
      StepId,
      Record<never, never>,
      StepMeta
    >({
      plugins: [
        {
          name: "analytics",
          setup: () => ({
            augmentMachine: () => ({
              inspect: () => "analytics"
            })
          })
        },
        {
          name: "debugger",
          setup: () => ({
            augmentMachine: () => ({
              inspect: () => "debugger"
            })
          })
        }
      ],
      setupContext: createSetupContext()
    });

    const machine = {} as unknown as JourneyMachine<
      Context,
      StepId,
      Record<never, never>,
      StepMeta
    >;

    expect(() => controller.extendMachine(machine)).toThrow(
      'Journey plugin "debugger" cannot add "inspect" — already provided by plugin "analytics".'
    );
  });
});
