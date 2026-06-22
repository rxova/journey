/* eslint-disable no-redeclare */
import type {
  AssertNoSelfTransitions,
  JourneyDefinition,
  JourneyJsonObject,
  JourneyMachinePlugin
} from "@rxova/journey-core";
import { createJourneyMachineRuntime } from "./create-journey-machine-runtime";
import type { JourneyRuntimeFactory, JourneyRuntimeFactoryFromDefinition } from "./types";
import type { JourneyHandlersOfDefinition, JourneyOptionsInput } from "./type-helpers";
import type { JourneyEmpty } from "@rxova/journey-core";

/**
 * Creates a typed factory for producing fresh React-bound journey runtimes.
 * Use this when a component or route boundary needs independent instances
 * from the same definition/options pair.
 */
export function createJourneyFactory<
  const TDefinition,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  definition: TDefinition & AssertNoSelfTransitions<NoInfer<TDefinition>>,
  options?: JourneyOptionsInput<TPlugins, JourneyHandlersOfDefinition<TDefinition>>
): JourneyRuntimeFactoryFromDefinition<TDefinition, TPlugins>;
export function createJourneyFactory<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = JourneyEmpty,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  definition: JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>,
  options?: JourneyOptionsInput<TPlugins, THandlers>
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
      options as JourneyOptionsInput<TPlugins, THandlers> | undefined
    );
}
