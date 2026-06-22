import { describe, expect, it, vi } from "vitest";

import {
  createJourneyMachine,
  getJourneyMachineDevtoolsRegistry,
  type JourneyDefinition,
  type JourneyMachineDevtoolsFeatureSpec
} from "@rxova/journey-core";
import { createAnalyticsPlugin } from "@rxova/journey-core/analytics";
import { createAutosavePlugin } from "@rxova/journey-core/autosave";
import { createDiagnosticsPlugin } from "@rxova/journey-core/diagnostics";
import { createExecutionPathsPlugin } from "@rxova/journey-core/execution-paths";
import {
  createPersistenceController,
  createPersistencePlugin
} from "@rxova/journey-core/persistence";
import { createReplayPlugin } from "@rxova/journey-core/replay";

import type { JourneyJsonObject, JourneyStorage } from "../src/types";

type StepId = "start" | "review";
type Context = {
  count: number;
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
      goToNextStep: [{ to: "review" }],
      goToStepById: [{ to: "review" }]
    }
  }
});

const getFeature = (
  machine: ReturnType<typeof createJourneyMachine<Context, StepId>>,
  featureId: string
) => {
  const feature = getJourneyMachineDevtoolsRegistry(machine)?.features.find(
    (item) => item.id === featureId
  );
  if (!feature) {
    throw new Error(`Missing devtools feature "${featureId}".`);
  }
  return feature as JourneyMachineDevtoolsFeatureSpec<
    Context,
    StepId,
    never,
    unknown,
    Record<never, never>
  >;
};

const getOperation = (
  feature: JourneyMachineDevtoolsFeatureSpec<Context, StepId, never, unknown, Record<never, never>>,
  operationId: string
) => {
  const operation = feature.operations.find((item) => item.id === operationId);
  if (!operation) {
    throw new Error(`Missing devtools operation "${operationId}".`);
  }
  return operation;
};

describe("package devtools feature coverage", () => {
  it("runs analytics devtools operations and maintains a bounded event buffer", async () => {
    const track = vi.fn();
    const machine = createJourneyMachine(createJourney(), {
      plugins: [
        createAnalyticsPlugin({
          track,
          machineId: "analytics-machine",
          includeStepMeta: true
        })
      ] as const
    });
    const feature = getFeature(machine, "analytics");
    const trackCustom = getOperation(feature, "analytics.trackCustomEvent");
    const inspect = getOperation(feature, "analytics.inspectRecentEvents");
    const clear = getOperation(feature, "analytics.clearRecentEvents");

    await machine.startJourney();
    for (let index = 0; index < 101; index += 1) {
      await trackCustom.run({
        machine,
        journey: createJourney(),
        resolvedJourney: getJourneyMachineDevtoolsRegistry(machine)?.resolvedJourney as never,
        input: { name: `custom-${index}`, payload: { index } }
      });
    }

    const inspected = await inspect.run({
      machine,
      journey: createJourney(),
      resolvedJourney: getJourneyMachineDevtoolsRegistry(machine)?.resolvedJourney as never,
      input: undefined
    });
    expect(inspected.kind).toBe("data");
    if (inspected.kind === "data") {
      const data = inspected.data as {
        machineId: string;
        includeStepMeta: boolean;
        bufferSize: number;
        entries: Array<{ tracked: { name: string } }>;
      };
      expect(data.machineId).toBe("analytics-machine");
      expect(data.includeStepMeta).toBe(true);
      expect(data.bufferSize).toBe(100);
      expect(data.entries).toHaveLength(100);
      expect(data.entries[0]?.tracked.name).toBe("custom-1");
    }

    await clear.run({
      machine,
      journey: createJourney(),
      resolvedJourney: getJourneyMachineDevtoolsRegistry(machine)?.resolvedJourney as never,
      input: undefined
    });
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ name: "custom-100" }));
  });

  it("supports analytics devtools operations before machine augmentation", async () => {
    const track = vi.fn();
    const plugin = createAnalyticsPlugin<JourneyJsonObject, string>({ track });
    const hooks = plugin.setup();
    const feature = hooks.getDevtoolsFeatures?.()[0];
    const trackCustom = feature?.operations.find(
      (operation) => operation.id === "analytics.trackCustomEvent"
    );
    const inspect = feature?.operations.find(
      (operation) => operation.id === "analytics.inspectRecentEvents"
    );

    const result = await trackCustom?.run({
      machine: {} as never,
      journey: {} as never,
      resolvedJourney: {} as never,
      input: { name: "pre-augment", payload: { value: 1 } }
    });
    const defaulted = await trackCustom?.run({
      machine: {} as never,
      journey: {} as never,
      resolvedJourney: {} as never,
      input: undefined
    });
    const inspected = await inspect?.run({
      machine: {} as never,
      journey: {} as never,
      resolvedJourney: {} as never,
      input: undefined
    });

    expect(result).toMatchObject({
      kind: "data",
      data: {
        name: "pre-augment",
        payload: { value: 1 }
      }
    });
    expect(defaulted).toMatchObject({
      kind: "data",
      data: {
        name: "",
        payload: {}
      }
    });
    expect(inspected).toMatchObject({
      kind: "data",
      data: {
        machineId: null,
        includeStepMeta: false
      }
    });
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ name: "pre-augment" }));

    const machineIdTrack = vi.fn();
    const machineIdHooks = createAnalyticsPlugin<JourneyJsonObject, string>({
      track: machineIdTrack,
      machineId: "pre"
    }).setup();
    const machineIdTrackCustom = machineIdHooks
      .getDevtoolsFeatures?.()[0]
      ?.operations.find((operation) => operation.id === "analytics.trackCustomEvent");
    await machineIdTrackCustom?.run({
      machine: {} as never,
      journey: {} as never,
      resolvedJourney: {} as never,
      input: { name: "pre-machine" }
    });
    expect(machineIdTrack).toHaveBeenCalledWith(
      expect.objectContaining({ name: "pre-machine", machineId: "pre" })
    );
  });

  it("runs autosave devtools operations", async () => {
    const { storage, store } = createStorage();
    const machine = createJourneyMachine(createJourney(), {
      plugins: [
        createAutosavePlugin({
          key: "journey:devtools:autosave",
          storage,
          debounceMs: 50,
          saveOn: ["context"]
        })
      ] as const
    });
    const feature = getFeature(machine, "autosave");
    const inspect = getOperation(feature, "autosave.inspect");
    const flush = getOperation(feature, "autosave.flush");
    const clear = getOperation(feature, "autosave.clear");

    await machine.startJourney();
    await machine.updateContext((context) => ({ ...context, count: 2 }));

    const inspected = await inspect.run({
      machine,
      journey: createJourney(),
      resolvedJourney: getJourneyMachineDevtoolsRegistry(machine)?.resolvedJourney as never,
      input: undefined
    });
    expect(inspected.kind).toBe("data");
    if (inspected.kind === "data") {
      expect(inspected.data).toMatchObject({
        state: { status: "pending", pendingReason: "context" },
        debounceMs: 50,
        hydrate: true,
        saveOn: ["context"]
      });
    }

    await flush.run({
      machine,
      journey: createJourney(),
      resolvedJourney: getJourneyMachineDevtoolsRegistry(machine)?.resolvedJourney as never,
      input: undefined
    });
    expect(store.has("journey:devtools:autosave")).toBe(true);

    await clear.run({
      machine,
      journey: createJourney(),
      resolvedJourney: getJourneyMachineDevtoolsRegistry(machine)?.resolvedJourney as never,
      input: undefined
    });
    expect(store.has("journey:devtools:autosave")).toBe(false);
    expect(machine.getAutosaveState()).toEqual({ status: "idle" });
  });

  it("runs replay devtools operations", async () => {
    const machine = createJourneyMachine(createJourney(), {
      plugins: [createReplayPlugin()] as const
    });
    const feature = getFeature(machine, "replay");
    const inspect = getOperation(feature, "replay.inspectSession");
    const exportSession = getOperation(feature, "replay.exportSession");
    const clear = getOperation(feature, "replay.clearSession");

    await machine.startJourney();
    await machine.goToNextStep();

    const inspected = await inspect.run({
      machine,
      journey: createJourney(),
      resolvedJourney: getJourneyMachineDevtoolsRegistry(machine)?.resolvedJourney as never,
      input: undefined
    });
    expect(inspected.kind).toBe("data");
    if (inspected.kind === "data") {
      expect(inspected.data).toMatchObject({ version: 1 });
    }

    const exported = await exportSession.run({
      machine,
      journey: createJourney(),
      resolvedJourney: getJourneyMachineDevtoolsRegistry(machine)?.resolvedJourney as never,
      input: { pretty: true }
    });
    expect(exported.kind).toBe("text");
    if (exported.kind === "text") {
      expect(JSON.parse(exported.text)).toMatchObject({ version: 1 });
    }

    await clear.run({
      machine,
      journey: createJourney(),
      resolvedJourney: getJourneyMachineDevtoolsRegistry(machine)?.resolvedJourney as never,
      input: undefined
    });
    expect(machine.getReplaySession()).toMatchObject({
      initialSnapshot: expect.objectContaining({ currentStepId: "review" }),
      entries: [],
      truncated: false
    });
  });

  it("runs diagnostics and execution-path devtools operations with fallback inputs", async () => {
    const machine = createJourneyMachine(createJourney(), {
      requireExplicitCompletion: true,
      plugins: [createDiagnosticsPlugin(), createExecutionPathsPlugin()] as const
    });
    const registry = getJourneyMachineDevtoolsRegistry(machine);
    const diagnostics = getOperation(getFeature(machine, "diagnostics"), "diagnostics.inspect");
    const executionPaths = getOperation(
      getFeature(machine, "execution-paths"),
      "execution-paths.inspect"
    );

    const diagnosticsDefault = await diagnostics.run({
      machine,
      journey: createJourney(),
      resolvedJourney: registry?.resolvedJourney as never,
      input: undefined
    });
    const diagnosticsOverride = await diagnostics.run({
      machine,
      journey: createJourney(),
      resolvedJourney: registry?.resolvedJourney as never,
      input: { requireExplicitCompletion: false }
    });
    const pathsDefault = await executionPaths.run({
      machine,
      journey: createJourney(),
      resolvedJourney: registry?.resolvedJourney as never,
      input: undefined
    });
    const pathsLimited = await executionPaths.run({
      machine,
      journey: createJourney(),
      resolvedJourney: registry?.resolvedJourney as never,
      input: { maxDepth: 2.8, maxPaths: 1.9 }
    });

    expect(diagnosticsDefault.kind).toBe("data");
    expect(diagnosticsOverride.kind).toBe("data");
    expect(pathsDefault.kind).toBe("data");
    expect(pathsLimited.kind).toBe("data");
  });

  it("runs persistence devtools operations", async () => {
    const { storage, store } = createStorage();
    const machine = createJourneyMachine(createJourney(), {
      plugins: [
        createPersistencePlugin({
          key: "journey:devtools:persistence",
          storage,
          clearOnReset: true
        })
      ] as const
    });
    const registry = getJourneyMachineDevtoolsRegistry(machine);
    const feature = getFeature(machine, "persistence");
    const inspect = getOperation(feature, "persistence.inspect");
    const clear = getOperation(feature, "persistence.clear");

    await machine.startJourney();
    await machine.updateContext((context) => ({ ...context, count: 4 }));
    expect(store.has("journey:devtools:persistence")).toBe(true);

    const inspected = await inspect.run({
      machine,
      journey: createJourney(),
      resolvedJourney: registry?.resolvedJourney as never,
      input: undefined
    });
    expect(inspected.kind).toBe("data");

    await clear.run({
      machine,
      journey: createJourney(),
      resolvedJourney: registry?.resolvedJourney as never,
      input: undefined
    });
    expect(store.has("journey:devtools:persistence")).toBe(false);

    expect(
      createPersistenceController({
        initial: "start" as "start" | "review",
        context: { count: 0 },
        steps: { start: {}, review: {} }
      }).inspectPersistedState()
    ).toMatchObject({ enabled: false, key: null });

    const failingController = createPersistenceController({
      initial: "start" as "start" | "review",
      context: { count: 0 },
      steps: { start: {}, review: {} },
      options: {
        key: "journey:devtools:persistence:error",
        storage: {
          getItem: () => {
            throw new Error("inspect failed");
          },
          setItem: vi.fn(),
          removeItem: vi.fn()
        }
      }
    });
    expect(failingController.inspectPersistedState()).toMatchObject({
      enabled: true,
      hasStoredValue: false,
      allowList: []
    });
  });

  it("exposes devtools force-step controls for idled, running, and invalid targets", async () => {
    const machine = createJourneyMachine(createJourney());
    const forceStepTransition =
      getJourneyMachineDevtoolsRegistry(machine)?.controls?.forceStepTransition;
    expect(forceStepTransition).toBeTypeOf("function");

    const idled = await forceStepTransition?.("review");
    expect(idled?.transitioned).toBe(false);
    expect(idled?.snapshot.currentStepId).toBe("start");

    await machine.startJourney();
    const forced = await forceStepTransition?.("review");
    expect(forced?.transitioned).toBe(true);
    expect(forced?.transitionId).toBe("devtools.forceStep");
    expect(forced?.snapshot.currentStepId).toBe("review");

    expect(() => forceStepTransition?.("missing" as StepId)).toThrow('Unknown step "missing".');
  });
});
