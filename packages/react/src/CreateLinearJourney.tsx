import { createLinearJourney as coreCreateLinearJourney } from "@rxova/journey-core";
import type {
  JourneyJsonObject,
  JourneyMachineOptions,
  JourneyMachinePlugin,
  LinearJourneyDefinition
} from "@rxova/journey-core";
import { buildJourneyRuntime } from "./create-journey-machine-runtime";
import type { LinearJourneyRuntime } from "./types";
import type { JourneyOptionsInput } from "./type-helpers";

/** Creates a linear journey runtime for React. Returns a `LinearJourneyRuntime` with hooks, provider, and the extended `LinearJourneyMachine`. */
export function createLinearJourney<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  definition: LinearJourneyDefinition<TContext, TStepId, TStepMeta, THandlers>,
  options?: JourneyOptionsInput<TPlugins>
): LinearJourneyRuntime<TContext, TStepId, TStepMeta, TPlugins, THandlers> {
  const machine = coreCreateLinearJourney<TContext, TStepId, TStepMeta, THandlers, TPlugins>(
    definition,
    options as JourneyMachineOptions<TPlugins> | undefined
  );
  const runtime = buildJourneyRuntime(machine);
  return { ...runtime, machine } as unknown as LinearJourneyRuntime<
    TContext,
    TStepId,
    TStepMeta,
    TPlugins,
    THandlers
  >;
}
