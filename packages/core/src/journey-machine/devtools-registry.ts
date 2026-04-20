import type {
  JourneyDefinition,
  JourneyJsonObject,
  JourneyMachine,
  JourneyMachineDevtoolsFeatureSpec,
  JourneyResolvedDefinition
} from "../types";

export const JOURNEY_MACHINE_DEVTOOLS_SYMBOL = Symbol.for("rxova.journey.devtools");

export type JourneyMachineDevtoolsRegistry<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>
> = {
  features: readonly JourneyMachineDevtoolsFeatureSpec<
    TContext,
    TStepId,
    TEventMap,
    TStepMeta,
    THandlers
  >[];
  journey: JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>;
  resolvedJourney: JourneyResolvedDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>;
};

export const attachJourneyMachineDevtoolsRegistry = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>
>(
  machine: JourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers>,
  registry: JourneyMachineDevtoolsRegistry<TContext, TStepId, TEventMap, TStepMeta, THandlers>
) => {
  Object.defineProperty(machine, JOURNEY_MACHINE_DEVTOOLS_SYMBOL, {
    value: registry,
    enumerable: false,
    configurable: false,
    writable: false
  });
};

export const getJourneyMachineDevtoolsRegistry = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>
>(
  machine: JourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers>
) =>
  (machine as Record<PropertyKey, unknown>)[JOURNEY_MACHINE_DEVTOOLS_SYMBOL] as
    | JourneyMachineDevtoolsRegistry<TContext, TStepId, TEventMap, TStepMeta, THandlers>
    | undefined;
