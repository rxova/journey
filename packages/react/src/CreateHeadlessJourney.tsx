import { createHeadlessJourney as coreCreateHeadlessJourney } from "@rxova/journey-core";
import type {
  HeadlessJourneyDefinition,
  JourneyJsonObject,
  JourneyMachineOptions,
  JourneyMachinePlugin
} from "@rxova/journey-core";
import { buildJourneyRuntime } from "./create-journey-machine-runtime";
import type { JourneyRuntime } from "./types";
import type { JourneyOptionsInput } from "./type-helpers";

export function createHeadlessJourney<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  definition: HeadlessJourneyDefinition<TContext, TStepId, TStepMeta, THandlers>,
  options?: JourneyOptionsInput<TPlugins>
): JourneyRuntime<TContext, TStepId, Record<never, never>, TStepMeta, TPlugins, THandlers> {
  const machine = coreCreateHeadlessJourney<TContext, TStepId, TStepMeta, THandlers, TPlugins>(
    definition,
    options as JourneyMachineOptions<TPlugins> | undefined
  );
  return buildJourneyRuntime(machine);
}
