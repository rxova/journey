import { createJourneyMachine } from "@rxova/journey-core";
import type {
  JourneyDefinition,
  JourneyJsonObject,
  JourneyMachineOptions,
  JourneyMachinePlugin,
  JourneyMachineWithPlugins
} from "@rxova/journey-core";
import { createJourneyProviderArtifacts } from "./Provider";
import { createJourneyHooks } from "./Hooks";
import type { JourneyRuntime } from "./types";
import type { JourneyOptionsInput } from "./type-helpers";

export const buildJourneyRuntime = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  machine: JourneyMachineWithPlugins<TContext, TStepId, TEventMap, TStepMeta, THandlers, TPlugins>
): JourneyRuntime<TContext, TStepId, TEventMap, TStepMeta, TPlugins, THandlers> => {
  const hooks = createJourneyHooks<TContext, TStepId, TEventMap, TStepMeta, THandlers, TPlugins>(
    machine
  );
  const providerArtifacts = createJourneyProviderArtifacts<
    TContext,
    TStepId,
    TEventMap,
    TStepMeta,
    THandlers,
    TPlugins
  >(machine, hooks.useJourneySelector);

  return {
    machine,
    dispose: () => machine.dispose(),
    ...hooks,
    ...providerArtifacts
  };
};

export const createJourneyMachineRuntime = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  definition: JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>,
  options?: JourneyOptionsInput<TPlugins>
): JourneyRuntime<TContext, TStepId, TEventMap, TStepMeta, TPlugins, THandlers> => {
  const machineOptions = options as JourneyMachineOptions<TPlugins> | undefined;
  const machine = createJourneyMachine<
    TContext,
    TStepId,
    TEventMap,
    TStepMeta,
    THandlers,
    TPlugins
  >(definition, machineOptions) as JourneyMachineWithPlugins<
    TContext,
    TStepId,
    TEventMap,
    TStepMeta,
    THandlers,
    TPlugins
  >;
  return buildJourneyRuntime(machine);
};
