import { isPromiseLike, warnInDevelopment } from "./helpers";

import type {
  JourneyDefinition,
  JourneyJsonObject,
  JourneyMachine,
  JourneyMachineDevtoolsFeatureSpec,
  JourneyMachinePlugin,
  JourneyMachinePluginHooks,
  JourneyMachinePluginSetupContext,
  JourneyMachineSnapshotReason,
  JourneyResolvedDefinition,
  JourneySnapshot
} from "../types";

export type JourneyMachinePluginController<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta,
  THandlers extends Record<string, unknown>
> = {
  hydrateSnapshot: (
    snapshot: JourneySnapshot<TContext, TStepId>
  ) => JourneySnapshot<TContext, TStepId>;
  onSnapshotChange: (args: {
    previousSnapshot: JourneySnapshot<TContext, TStepId>;
    snapshot: JourneySnapshot<TContext, TStepId>;
    reason: JourneyMachineSnapshotReason;
  }) => void;
  extendMachine: (
    machine: JourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers>
  ) => JourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers>;
  dispose: () => void;
  getDevtoolsFeatures: (
    machine: JourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers>
  ) => readonly JourneyMachineDevtoolsFeatureSpec<
    TContext,
    TStepId,
    TEventMap,
    TStepMeta,
    THandlers
  >[];
};

export const createJourneyMachinePluginController = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta,
  THandlers extends Record<string, unknown> = Record<never, never>
>({
  plugins,
  setupContext
}: {
  plugins: readonly JourneyMachinePlugin[];
  setupContext: JourneyMachinePluginSetupContext<
    TContext,
    TStepId,
    TEventMap,
    TStepMeta,
    THandlers
  >;
}): JourneyMachinePluginController<TContext, TStepId, TEventMap, TStepMeta, THandlers> => {
  const hooks: {
    name: string;
    hooks: JourneyMachinePluginHooks<TContext, TStepId, TEventMap, TStepMeta, THandlers>;
  }[] = [];

  for (const plugin of plugins) {
    try {
      hooks.push({
        name: plugin.name,
        hooks: plugin.setup(setupContext) as JourneyMachinePluginHooks<
          TContext,
          TStepId,
          TEventMap,
          TStepMeta,
          THandlers
        >
      });
    } catch (error) {
      for (const initializedPlugin of [...hooks].reverse()) {
        try {
          initializedPlugin.hooks.dispose?.();
        } catch {
          // Preserve the original setup error; cleanup failures are secondary.
        }
      }

      const message = error instanceof Error ? error.message : String(error);
      const pluginError = new Error(`Journey plugin "${plugin.name}" setup failed: ${message}`);
      Object.assign(pluginError, { cause: error });
      throw pluginError;
    }
  }

  const assertUniqueDevtoolsIds = (
    features: readonly JourneyMachineDevtoolsFeatureSpec<
      TContext,
      TStepId,
      TEventMap,
      TStepMeta,
      THandlers
    >[]
  ) => {
    const featureIds = new Set<string>();
    const operationIds = new Set<string>();

    for (const feature of features) {
      if (featureIds.has(feature.id)) {
        throw new Error(`Journey devtools feature "${feature.id}" is already registered.`);
      }
      featureIds.add(feature.id);

      for (const operation of feature.operations) {
        if (operationIds.has(operation.id)) {
          throw new Error(`Journey devtools operation "${operation.id}" is already registered.`);
        }
        operationIds.add(operation.id);
      }
    }
  };

  return {
    hydrateSnapshot: (snapshot) =>
      hooks.reduce(
        (currentSnapshot, plugin) =>
          plugin.hooks.hydrateSnapshot?.(currentSnapshot) ?? currentSnapshot,
        snapshot
      ),
    onSnapshotChange: ({ previousSnapshot, snapshot, reason }) => {
      let firstError: unknown;
      for (const plugin of hooks) {
        try {
          const result = plugin.hooks.onSnapshotChange?.({
            previousSnapshot,
            snapshot,
            reason
          });
          if (isPromiseLike(result)) {
            warnInDevelopment(
              `Journey plugin "${plugin.name}" returned a Promise from onSnapshotChange. ` +
                "This hook must be synchronous; returning a Promise blocks the machine and the await is dropped."
            );
          }
        } catch (error) {
          firstError ??= error;
        }
      }
      if (firstError !== undefined) {
        throw firstError;
      }
    },
    extendMachine: (machine) => {
      const extensionTarget = machine as JourneyMachine<
        TContext,
        TStepId,
        TEventMap,
        TStepMeta,
        THandlers
      >;
      const writableExtensionTarget = machine as Record<string, unknown>;
      const pluginExtensionKeys = new Map<string, string>();

      for (const plugin of hooks) {
        const extension = plugin.hooks.augmentMachine?.({
          machine,
          journey: setupContext.journey as JourneyDefinition<
            TContext,
            TStepId,
            TEventMap,
            TStepMeta,
            THandlers
          >,
          resolvedJourney: setupContext.resolvedJourney as JourneyResolvedDefinition<
            TContext,
            TStepId,
            TEventMap,
            TStepMeta,
            THandlers
          >
        });

        if (!extension) {
          continue;
        }

        for (const [key, value] of Object.entries(extension)) {
          const existingPlugin = pluginExtensionKeys.get(key);
          if (existingPlugin) {
            throw new Error(
              `Journey plugin "${plugin.name}" cannot add "${key}" — already provided by plugin "${existingPlugin}".`
            );
          }
          if (key in extensionTarget) {
            throw new Error(
              `Journey plugin "${plugin.name}" cannot override machine property "${key}".`
            );
          }
          pluginExtensionKeys.set(key, plugin.name);
          writableExtensionTarget[key] = value;
        }
      }

      return extensionTarget;
    },
    dispose: () => {
      let firstError: unknown;
      for (const plugin of hooks) {
        try {
          plugin.hooks.dispose?.();
        } catch (error) {
          firstError ??= error;
        }
      }
      if (firstError !== undefined) {
        throw firstError;
      }
    },
    getDevtoolsFeatures: (machine) => {
      const features = hooks.flatMap((plugin) => {
        try {
          return (
            plugin.hooks.getDevtoolsFeatures?.({
              machine,
              journey: setupContext.journey as JourneyDefinition<
                TContext,
                TStepId,
                TEventMap,
                TStepMeta,
                THandlers
              >,
              resolvedJourney: setupContext.resolvedJourney as JourneyResolvedDefinition<
                TContext,
                TStepId,
                TEventMap,
                TStepMeta,
                THandlers
              >
            }) ?? []
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const wrappedError = new Error(
            `Journey plugin "${plugin.name}" devtools registration failed: ${message}`
          );
          Object.assign(wrappedError, { cause: error });
          throw wrappedError;
        }
      });

      assertUniqueDevtoolsIds(features);
      return features;
    }
  };
};
