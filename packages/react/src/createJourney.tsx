/* eslint-disable no-redeclare */
import { createJourneyMachine } from "@rxova/journey-core";
import type {
  JourneyDefinition,
  JourneyJsonObject,
  JourneyMachineOptions,
  JourneyMachinePlugin,
  JourneyMachineWithPlugins
} from "@rxova/journey-core";
import { createJourneyProviderArtifacts } from "./provider";
import { createJourneyHooks } from "./runtime-hooks";
import type {
  JourneyRuntime,
  JourneyRuntimeFactoryFromDefinition,
  JourneyRuntimeFromDefinition,
  JourneyRuntimeFactory
} from "./types";

type JourneyOptionsInput<TPlugins extends readonly JourneyMachinePlugin[]> = JourneyMachineOptions<
  TPlugins extends [] ? readonly JourneyMachinePlugin[] : TPlugins
>;

const createJourneyMachineRuntime = <
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

/**
 * Creates a journey machine and returns React hooks/components bound to that machine.
 * Hooks work without a provider; `JourneyProvider` is only required for `StepRenderer`.
 */
export function createJourney<TDefinition, TPlugins extends readonly JourneyMachinePlugin[] = []>(
  definition: TDefinition,
  options?: JourneyOptionsInput<TPlugins>
): JourneyRuntimeFromDefinition<TDefinition, TPlugins>;
export function createJourney<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  definition: JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>,
  options?: JourneyOptionsInput<TPlugins>
): JourneyRuntime<TContext, TStepId, TEventMap, TStepMeta, TPlugins, THandlers> {
  return createJourneyMachineRuntime(definition, options);
}

/**
 * Creates a typed factory for producing fresh React-bound journey runtimes.
 * Use this when a component or route boundary needs independent instances
 * from the same definition/options pair.
 */
export function createJourneyFactory<
  TDefinition,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  definition: TDefinition,
  options?: JourneyOptionsInput<TPlugins>
): JourneyRuntimeFactoryFromDefinition<TDefinition, TPlugins>;
export function createJourneyFactory<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  definition: JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>,
  options?: JourneyOptionsInput<TPlugins>
): JourneyRuntimeFactory<TContext, TStepId, TEventMap, TStepMeta, TPlugins, THandlers> {
  const runtimeDefinition = definition as JourneyDefinition<
    TContext,
    TStepId,
    TEventMap,
    TStepMeta,
    THandlers
  >;

  return () =>
    createJourneyMachineRuntime(
      runtimeDefinition,
      options as JourneyOptionsInput<TPlugins> | undefined
    );
}
