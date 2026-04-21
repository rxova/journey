/* eslint-disable no-redeclare */
import type {
  JourneyDefinition,
  JourneyJsonObject,
  JourneyMachinePlugin
} from "@rxova/journey-core";
import { createJourneyMachineRuntime } from "./create-journey-machine-runtime";
import type { JourneyRuntime, JourneyRuntimeFromDefinition } from "./types";
import type { JourneyOptionsInput } from "./type-helpers";

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
