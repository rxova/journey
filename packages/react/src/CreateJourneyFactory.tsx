/* eslint-disable no-redeclare */
import type {
  JourneyDefinition,
  JourneyJsonObject,
  JourneyMachinePlugin
} from "@rxova/journey-core";
import { createJourneyMachineRuntime } from "./create-journey-machine-runtime";
import type { JourneyRuntimeFactory, JourneyRuntimeFactoryFromDefinition } from "./types";
import type { JourneyOptionsInput } from "./type-helpers";

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
