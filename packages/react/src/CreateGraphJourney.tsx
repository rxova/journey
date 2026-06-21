/* eslint-disable no-redeclare */
import { createGraphJourney as coreCreateGraphJourney } from "@rxova/journey-core";
import type {
  GraphJourneyDefinition,
  JourneyJsonObject,
  JourneyMachineOptions,
  JourneyMachinePlugin,
  JourneyMachineWithPlugins
} from "@rxova/journey-core";
import { buildJourneyRuntime } from "./create-journey-machine-runtime";
import type { JourneyRuntime, JourneyRuntimeFromDefinition } from "./types";
import type { JourneyOptionsInput } from "./type-helpers";

/**
 * Creates a graph journey runtime for React from a `GraphJourneyDefinition` or
 * builder output. Builder-authored definitions infer per-step typing and return
 * a runtime with `useStepApi`.
 */
export function createGraphJourney<
  TDefinition,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  definition: TDefinition,
  options?: JourneyOptionsInput<TPlugins>
): JourneyRuntimeFromDefinition<TDefinition, TPlugins>;
export function createGraphJourney<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  definition: GraphJourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>,
  options?: JourneyOptionsInput<TPlugins>
): JourneyRuntime<TContext, TStepId, TEventMap, TStepMeta, TPlugins, THandlers> {
  const machine = coreCreateGraphJourney(
    definition,
    options as JourneyMachineOptions<TPlugins> | undefined
  ) as JourneyMachineWithPlugins<TContext, TStepId, TEventMap, TStepMeta, THandlers, TPlugins>;
  return buildJourneyRuntime(machine);
}
