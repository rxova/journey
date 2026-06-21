/* eslint-disable no-redeclare */
import type {
  JourneyDefinition,
  JourneyJsonObject,
  JourneyMachinePlugin
} from "@rxova/journey-core";
import { createJourneyMachineRuntime } from "./create-journey-machine-runtime";
import type { JourneyRuntime, JourneyRuntimeFromDefinition } from "./types";
import type { JourneyHandlersOfDefinition, JourneyOptionsInput } from "./type-helpers";
import type { JourneyEmpty } from "@rxova/journey-core";

/**
 * Creates a journey machine and returns React hooks/components bound to that machine.
 * Hooks work without a provider; `JourneyProvider` is only required for `StepRenderer`.
 */
export function createJourney<TDefinition, TPlugins extends readonly JourneyMachinePlugin[] = []>(
  definition: TDefinition,
  options?: JourneyOptionsInput<TPlugins, JourneyHandlersOfDefinition<TDefinition>>
): JourneyRuntimeFromDefinition<TDefinition, TPlugins>;
export function createJourney<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = JourneyEmpty,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  definition: JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>,
  options?: JourneyOptionsInput<TPlugins, THandlers>
): JourneyRuntime<TContext, TStepId, TEventMap, TStepMeta, TPlugins, THandlers> {
  return createJourneyMachineRuntime(definition, options);
}
