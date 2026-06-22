/* eslint-disable no-redeclare */
import { createGraphJourney as coreCreateGraphJourney } from "@rxova/journey-core";
import type {
  AssertNoSelfTransitions,
  GraphJourneyDefinition,
  JourneyJsonObject,
  JourneyMachineOptions,
  JourneyMachinePlugin,
  JourneyMachineWithPlugins
} from "@rxova/journey-core";
import { buildJourneyRuntime } from "./create-journey-machine-runtime";
import type { JourneyRuntime, JourneyRuntimeFromDefinition } from "./types";
import type { JourneyHandlersOfDefinition, JourneyOptionsInput } from "./type-helpers";
import type { JourneyEmpty } from "@rxova/journey-core";

/**
 * Creates a graph journey runtime for React from a `GraphJourneyDefinition` or
 * builder output. Builder-authored definitions infer per-step typing and return
 * a runtime with `useStepApi`.
 */
export function createGraphJourney<
  const TDefinition,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  definition: TDefinition & AssertNoSelfTransitions<NoInfer<TDefinition>>,
  options?: JourneyOptionsInput<TPlugins, JourneyHandlersOfDefinition<TDefinition>>
): JourneyRuntimeFromDefinition<TDefinition, TPlugins>;
export function createGraphJourney<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = JourneyEmpty,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  definition: GraphJourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>,
  options?: JourneyOptionsInput<TPlugins, THandlers>
): JourneyRuntime<TContext, TStepId, TEventMap, TStepMeta, TPlugins, THandlers> {
  const machine = coreCreateGraphJourney(
    definition,
    options as JourneyMachineOptions<TPlugins, THandlers> | undefined
  ) as JourneyMachineWithPlugins<TContext, TStepId, TEventMap, TStepMeta, THandlers, TPlugins>;
  return buildJourneyRuntime(machine);
}
