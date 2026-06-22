/* eslint-disable no-redeclare */
import { createJourneyMachine } from "./journey-machine";
import type {
  GraphJourneyDefinition,
  JourneyDefinition,
  JourneyJsonObject,
  JourneyMachinePlugin,
  JourneyMachineOptions,
  JourneyMachineWithPlugins
} from "./types";
import type { JourneyEmpty } from "./types";

/** Extracts the `THandlers` parameter from a journey definition type, defaulting to a loose record. */
type JourneyHandlersOfDefinition<TDefinition> =
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TDefinition extends JourneyDefinition<infer _TC, infer _TS, infer _TE, infer _TM, infer TH>
    ? TH
    : Record<string, unknown>;

/**
 * Required marker property whose *name* is the compile error a developer sees
 * when a transition targets its own step. Attaching it to the offending edge
 * (rather than narrowing `to`) keeps step-id inference intact.
 */
type SelfTransitionMarker<TStepId extends string> = {
  [Message in `Self-transition not allowed: step "${TStepId}" cannot target its own step; use api.updateContext(...) instead`]: true;
};

/** Marks every edge under step `TStepId` whose `to` equals `TStepId`. */
type MarkSelfTransitionEdges<TStepTransitions, TStepId extends string> = {
  [TEvent in keyof TStepTransitions]: TStepTransitions[TEvent] extends readonly unknown[]
    ? {
        [TIndex in keyof TStepTransitions[TEvent]]: TStepTransitions[TEvent][TIndex] extends {
          to: TStepId;
        }
          ? TStepTransitions[TEvent][TIndex] & SelfTransitionMarker<TStepId>
          : TStepTransitions[TEvent][TIndex];
      }
    : TStepTransitions[TEvent];
};

/**
 * Resolves to `unknown` (no constraint) unless a graph transition targets its
 * own step, in which case the offending edge gains a required marker property
 * it cannot satisfy — surfacing a descriptive error at the `to`. Intersected
 * with the definition via `NoInfer`, so it never participates in inference.
 */
type AssertNoSelfTransitions<TDefinition> = TDefinition extends { transitions: infer TGraph }
  ? TGraph extends readonly unknown[]
    ? unknown
    : {
        transitions: {
          [TStepId in keyof TGraph]: TStepId extends "global"
            ? TGraph[TStepId]
            : MarkSelfTransitionEdges<TGraph[TStepId], TStepId & string>;
        };
      }
  : unknown;

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
): TDefinition extends JourneyDefinition<infer TC, infer TS, infer TE, infer TM, infer TH>
  ? JourneyMachineWithPlugins<TC, TS, TE, TM, TH, TPlugins>
  : never;
export function createGraphJourney<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = JourneyEmpty,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  def: GraphJourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>,
  options?: JourneyMachineOptions<TPlugins, THandlers>
): JourneyMachineWithPlugins<TContext, TStepId, TEventMap, TStepMeta, THandlers, TPlugins>;
/** Creates a graph journey machine from a builder definition or a plain `GraphJourneyDefinition` with an object-keyed `transitions` map. */
export function createGraphJourney<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta,
  THandlers extends Record<string, unknown>,
  TPlugins extends readonly JourneyMachinePlugin[]
>(
  def: JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>,
  options?: JourneyMachineOptions<TPlugins, THandlers>
): JourneyMachineWithPlugins<TContext, TStepId, TEventMap, TStepMeta, THandlers, TPlugins> {
  return createJourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers, TPlugins>(
    def,
    options
  );
}
