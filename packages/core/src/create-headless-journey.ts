import { createJourneyMachine } from "./journey-machine";
import type {
  HeadlessJourneyDefinition,
  JourneyJsonObject,
  JourneyMachinePlugin,
  JourneyMachineOptions,
  JourneyMachineWithPlugins
} from "./types";

export function createHeadlessJourney<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  def: HeadlessJourneyDefinition<TContext, TStepId, TStepMeta, THandlers>,
  options?: JourneyMachineOptions<TPlugins>
): JourneyMachineWithPlugins<
  TContext,
  TStepId,
  Record<never, never>,
  TStepMeta,
  THandlers,
  TPlugins
> {
  return createJourneyMachine<
    TContext,
    TStepId,
    Record<never, never>,
    TStepMeta,
    THandlers,
    TPlugins
  >({ ...def }, options);
}
