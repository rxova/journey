import { createGraphJourney as coreCreateGraphJourney } from "@rxova/journey-core";
import type {
  GraphJourneyDefinition,
  JourneyJsonObject,
  JourneyMachineOptions,
  JourneyMachinePlugin
} from "@rxova/journey-core";
import { buildJourneyRuntime } from "./create-journey-machine-runtime";
import type { JourneyRuntime } from "./types";
import type { JourneyOptionsInput } from "./type-helpers";

/** Creates a graph journey runtime for React from a `GraphJourneyDefinition` or builder output. */
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
  const machine = coreCreateGraphJourney<
    TContext,
    TStepId,
    TEventMap,
    TStepMeta,
    THandlers,
    TPlugins
  >(definition, options as JourneyMachineOptions<TPlugins> | undefined);
  return buildJourneyRuntime(machine);
}
