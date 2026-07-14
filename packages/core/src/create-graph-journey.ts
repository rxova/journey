/* eslint-disable no-redeclare */
import { createJourneyMachine } from "./journey-machine";
import type {
  JourneyBaseEvent,
  AssertNoSelfTransitions,
  GraphJourneyDefinition,
  GraphJourneyMachine,
  JourneyDefinition,
  JourneyJsonObject,
  JourneyMachinePlugin,
  JourneyMachineOptions
} from "./types";
import type { JourneyEmpty } from "./types";

/** Extracts the `THandlers` parameter from a journey definition type, defaulting to a loose record. */
type JourneyHandlersOfDefinition<TDefinition> =
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TDefinition extends JourneyDefinition<infer _TC, infer _TS, infer _TE, infer _TM, infer TH>
    ? TH
    : Record<string, unknown>;

/**
 * Creates a graph journey machine from a builder definition or a plain
 * definition object with an object-style `transitions` map.
 * The builder overload accepts `JourneyBuilderDefinition` output directly.
 */
export function createGraphJourney<
  const TDefinition,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  def: TDefinition & AssertNoSelfTransitions<NoInfer<TDefinition>>,
  options?: JourneyMachineOptions<TPlugins, JourneyHandlersOfDefinition<TDefinition>>
): TDefinition extends JourneyDefinition<
  infer TC,
  infer TS,
  infer TE extends JourneyBaseEvent,
  infer TM,
  infer TH
>
  ? GraphJourneyMachine<TC, TS, TE, TM, TH, TPlugins>
  : never;
export function createGraphJourney<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  def: GraphJourneyDefinition<TContext, TStepId, TEvents, TStepMeta, THandlers>,
  options?: JourneyMachineOptions<TPlugins, THandlers>
): GraphJourneyMachine<TContext, TStepId, TEvents, TStepMeta, THandlers, TPlugins>;
/** Creates a graph journey machine from a builder definition or a plain `GraphJourneyDefinition` with an object-keyed `transitions` map. */
export function createGraphJourney<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent,
  TStepMeta,
  THandlers extends Record<string, unknown>,
  TPlugins extends readonly JourneyMachinePlugin[]
>(
  def: JourneyDefinition<TContext, TStepId, TEvents, TStepMeta, THandlers>,
  options?: JourneyMachineOptions<TPlugins, THandlers>
): GraphJourneyMachine<TContext, TStepId, TEvents, TStepMeta, THandlers, TPlugins> {
  return createJourneyMachine<TContext, TStepId, TEvents, TStepMeta, THandlers, TPlugins>(
    def,
    options
  ) as GraphJourneyMachine<TContext, TStepId, TEvents, TStepMeta, THandlers, TPlugins>;
}
