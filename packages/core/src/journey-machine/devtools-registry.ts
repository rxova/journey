import type {
  JourneyBaseEvent,
  JourneyDefinition,
  JourneyJsonObject,
  JourneyMachine,
  JourneyMachineDevtoolsFeatureSpec,
  JourneyResolvedDefinition,
  JourneySendResult
} from "../types";
import type { JourneyEmpty } from "../types";

export const JOURNEY_MACHINE_DEVTOOLS_SYMBOL = Symbol.for("rxova.journey.devtools");

export type JourneyMachineDevtoolsRegistry<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = {
  controls?: {
    forceStepTransition?: (stepId: TStepId) => Promise<JourneySendResult<TContext, TStepId>>;
  };
  features: readonly JourneyMachineDevtoolsFeatureSpec<
    TContext,
    TStepId,
    TEvents,
    TStepMeta,
    THandlers
  >[];
  journey: JourneyDefinition<TContext, TStepId, TEvents, TStepMeta, THandlers>;
  resolvedJourney: JourneyResolvedDefinition<TContext, TStepId, TEvents, TStepMeta, THandlers>;
};

export const attachJourneyMachineDevtoolsRegistry = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty
>(
  machine: JourneyMachine<TContext, TStepId, TEvents, TStepMeta, THandlers>,
  registry: JourneyMachineDevtoolsRegistry<TContext, TStepId, TEvents, TStepMeta, THandlers>
) => {
  Object.defineProperty(machine, JOURNEY_MACHINE_DEVTOOLS_SYMBOL, {
    value: registry,
    enumerable: false,
    configurable: false,
    writable: false
  });
};

/** Returns the internal devtools registry attached to a journey machine, when present. */
export const getJourneyMachineDevtoolsRegistry = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty
>(
  machine: JourneyMachine<TContext, TStepId, TEvents, TStepMeta, THandlers>
) =>
  (machine as Record<PropertyKey, unknown>)[JOURNEY_MACHINE_DEVTOOLS_SYMBOL] as
    | JourneyMachineDevtoolsRegistry<TContext, TStepId, TEvents, TStepMeta, THandlers>
    | undefined;
