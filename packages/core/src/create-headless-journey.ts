import { createJourneyMachine } from "./journey-machine";
import type {
  HeadlessJourneyDefinition,
  JourneyJsonObject,
  JourneyMachinePlugin,
  JourneyMachineOptions,
  JourneyMachineWithPlugins
} from "./types";
import type { JourneyEmpty } from "./types";

/** Creates a headless journey machine with no predefined transition graph. Navigation is entirely caller-driven via `goToStepById`. */
export function createHeadlessJourney<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  def: HeadlessJourneyDefinition<TContext, TStepId, TStepMeta, THandlers>,
  options?: JourneyMachineOptions<TPlugins, THandlers>
): JourneyMachineWithPlugins<TContext, TStepId, JourneyEmpty, TStepMeta, THandlers, TPlugins> {
  return createJourneyMachine<TContext, TStepId, JourneyEmpty, TStepMeta, THandlers, TPlugins>(
    { ...def },
    options
  );
}
