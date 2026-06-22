import type {
  JourneyBaseEvent,
  JourneyBuiltInFrom,
  JourneyEvent,
  JourneyEventFor,
  JourneyFullEventType,
  JourneyGoToEvent,
  JourneyHistory,
  JourneyJsonObject,
  JourneyPayloadFor,
  JourneySendEvent,
  JourneySendResult,
  JourneySnapshot,
  JourneyStepDefinition,
  JourneyTerminal
} from "./journey.types";
import type { JourneyEmpty } from "./journey.types";

type JourneyTransitionArgsBase<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  THandlers extends Record<string, unknown>
> = {
  snapshot: JourneySnapshot<TContext, TStepId>;
  context: Readonly<TContext>;
  from: TStepId;
  timeline: JourneyHistory<TStepId>["timeline"];
  index: number;
  signal: AbortSignal;
  handlers: THandlers;
};

type JourneyTransitionEventOfType<
  TStepId extends string,
  TEvents extends JourneyBaseEvent,
  TEventType extends JourneyFullEventType<TEvents>
> = TEventType extends "goToStepById"
  ? JourneyGoToEvent<TStepId, JourneyPayloadFor<TEvents, "goToStepById">>
  : [JourneyEventFor<TEvents, TEventType>] extends [never]
    ? { type: TEventType; payload?: unknown }
    : JourneyEventFor<TEvents, TEventType>;

export type JourneyDispatch<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent
> = (event: JourneySendEvent<TStepId, TEvents>) => Promise<JourneySendResult<TContext, TStepId>>;

export type JourneyLifecycleArgs<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent,
  THandlers extends Record<string, unknown>
> = {
  snapshot: JourneySnapshot<TContext, TStepId>;
  context: Readonly<TContext>;
  from: TStepId;
  to: TStepId | JourneyTerminal;
  event: { type: string; payload?: unknown };
  transitionId: string | null;
  label?: string;
  handlers: THandlers;
  signal: AbortSignal;
  dispatch: JourneyDispatch<TContext, TStepId, TEvents>;
};

/**
 * Wrap callback signatures to opt into TypeScript's bivariant parameter checking.
 * This keeps narrow event payload handlers assignable to wider transition slots.
 */
type JourneyBivariantCallback<TArgs, TResult> = {
  bivarianceHack(args: TArgs): TResult;
}["bivarianceHack"];

export type JourneyStepLifecycleCallback<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent,
  THandlers extends Record<string, unknown>
> = JourneyBivariantCallback<
  JourneyLifecycleArgs<TContext, TStepId, TEvents, THandlers>,
  void | Promise<void>
>;

export type JourneyTransitionArgs<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = JourneyTransitionArgsBase<TContext, TStepId, THandlers> & {
  event: JourneyEvent<TStepId, TEvents>;
};

export type JourneyTransitionArgsForEvent<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent,
  THandlers extends Record<string, unknown>,
  TEventType extends JourneyFullEventType<TEvents>
> = JourneyTransitionArgsBase<TContext, TStepId, THandlers> & {
  event: JourneyTransitionEventOfType<TStepId, TEvents, TEventType>;
};

export type JourneyTransitionUpdateContextArgsForEvent<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent,
  TEventType extends JourneyFullEventType<TEvents>
> = {
  snapshot: JourneySnapshot<TContext, TStepId>;
  context: Readonly<TContext>;
  from: TStepId;
  timeline: JourneyHistory<TStepId>["timeline"];
  index: number;
  event: JourneyTransitionEventOfType<TStepId, TEvents, TEventType>;
};

type JourneyStepTransitionEventType<TEvents extends JourneyBaseEvent> = Exclude<
  JourneyFullEventType<TEvents>,
  "completeJourney" | "terminateJourney" | "goToStepById"
>;

type JourneyTerminalTransitionEventType<TEvents extends JourneyBaseEvent> = Extract<
  JourneyFullEventType<TEvents>,
  "completeJourney" | "terminateJourney"
>;

export type JourneyTransitionTarget<TStepId extends string> = TStepId | JourneyTerminal;

type JourneyTransitionBehavior<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent,
  THandlers extends Record<string, unknown>,
  TEventType extends JourneyFullEventType<TEvents>
> = {
  label?: string;
  timeoutMs?: number;
  when?: JourneyBivariantCallback<
    JourneyTransitionArgsForEvent<TContext, TStepId, TEvents, THandlers, TEventType>,
    boolean | Promise<boolean>
  >;
  updateContext?: JourneyBivariantCallback<
    JourneyTransitionUpdateContextArgsForEvent<TContext, TStepId, TEvents, TEventType>,
    TContext
  >;
  onEnter?: JourneyStepLifecycleCallback<TContext, TStepId, TEvents, THandlers>;
  onLeave?: JourneyStepLifecycleCallback<TContext, TStepId, TEvents, THandlers>;
};

type JourneyTransitionConfig<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent,
  THandlers extends Record<string, unknown>,
  TEventType extends JourneyFullEventType<TEvents>
> = JourneyTransitionBehavior<TContext, TStepId, TEvents, THandlers, TEventType> & {
  from: TStepId | JourneyBuiltInFrom;
};

export type JourneyStepEventTransition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TEventType extends JourneyStepTransitionEventType<TEvents> =
    JourneyStepTransitionEventType<TEvents>
> = {
  [TSelectedEvent in TEventType]: JourneyTransitionConfig<
    TContext,
    TStepId,
    TEvents,
    THandlers,
    TSelectedEvent
  > & {
    event: TSelectedEvent;
    to: JourneyTransitionTarget<TStepId>;
  };
}[TEventType];

export type JourneyTerminalTransition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TEventType extends JourneyTerminalTransitionEventType<TEvents> =
    JourneyTerminalTransitionEventType<TEvents>
> = {
  [TSelectedEvent in TEventType]: JourneyTransitionConfig<
    TContext,
    TStepId,
    TEvents,
    THandlers,
    TSelectedEvent
  > & {
    event: TSelectedEvent;
    to?: never;
  };
}[TEventType];

export type JourneyGoToStepTransition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = JourneyTransitionConfig<TContext, TStepId, TEvents, THandlers, "goToStepById"> & {
  event: "goToStepById";
  to: TStepId;
};

export type JourneyTransition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  THandlers extends Record<string, unknown> = JourneyEmpty
> =
  | JourneyStepEventTransition<TContext, TStepId, TEvents, THandlers>
  | JourneyTerminalTransition<TContext, TStepId, TEvents, THandlers>
  | JourneyGoToStepTransition<TContext, TStepId, TEvents, THandlers>;

export type JourneyResolvedTransition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = JourneyTransition<TContext, TStepId, TEvents, THandlers> & {
  id: string;
  label?: string;
};

export type JourneyGlobalTransition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = JourneyTransition<TContext, TStepId, TEvents, THandlers> & {
  from: JourneyBuiltInFrom;
};

export type JourneyStepEventGraphEdge<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TEventType extends JourneyStepTransitionEventType<TEvents> =
    JourneyStepTransitionEventType<TEvents>
> = {
  [TSelectedEvent in TEventType]: JourneyTransitionBehavior<
    TContext,
    TStepId,
    TEvents,
    THandlers,
    TSelectedEvent
  > & {
    to: JourneyTransitionTarget<TStepId>;
  };
}[TEventType];

export type JourneyTerminalGraphEdge<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TEventType extends JourneyTerminalTransitionEventType<TEvents> =
    JourneyTerminalTransitionEventType<TEvents>
> = {
  [TSelectedEvent in TEventType]: JourneyTransitionBehavior<
    TContext,
    TStepId,
    TEvents,
    THandlers,
    TSelectedEvent
  > & {
    to?: never;
  };
}[TEventType];

export type JourneyGoToStepGraphEdge<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = JourneyTransitionBehavior<TContext, TStepId, TEvents, THandlers, "goToStepById"> & {
  to: TStepId;
};

export type JourneyGraphEdge<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TEventType extends JourneyFullEventType<TEvents> = JourneyFullEventType<TEvents>
> =
  | JourneyStepEventGraphEdge<
      TContext,
      TStepId,
      TEvents,
      THandlers,
      Extract<TEventType, JourneyStepTransitionEventType<TEvents>>
    >
  | JourneyTerminalGraphEdge<
      TContext,
      TStepId,
      TEvents,
      THandlers,
      Extract<TEventType, JourneyTerminalTransitionEventType<TEvents>>
    >
  | (Extract<TEventType, "goToStepById"> extends never
      ? never
      : JourneyGoToStepGraphEdge<TContext, TStepId, TEvents, THandlers>);

export type JourneyTerminalTransitionShorthand<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent,
  THandlers extends Record<string, unknown>,
  TEventType extends JourneyTerminalTransitionEventType<TEvents>
> =
  | true
  | readonly []
  | readonly JourneyGraphEdge<TContext, TStepId, TEvents, THandlers, TEventType>[];

export type JourneyStepTransitions<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = Partial<{
  [TSelectedEvent in JourneyFullEventType<TEvents>]: TSelectedEvent extends
    | "completeJourney"
    | "terminateJourney"
    ? JourneyTerminalTransitionShorthand<
        TContext,
        TStepId,
        TEvents,
        THandlers,
        Extract<TSelectedEvent, JourneyTerminalTransitionEventType<TEvents>>
      >
    : readonly JourneyGraphEdge<TContext, TStepId, TEvents, THandlers, TSelectedEvent>[];
}>;

export type JourneyGlobalKey = "global";

export type JourneyTransitionGraph<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = Partial<Record<TStepId, JourneyStepTransitions<TContext, TStepId, TEvents, THandlers>>> & {
  global?: JourneyStepTransitions<TContext, TStepId, TEvents, THandlers>;
};

export type JourneyLinearStep<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = JourneyTransitionBehavior<TContext, TStepId, TEvents, THandlers, "goToNextStep"> & {
  step: TStepId;
  when?: never;
  to?: never;
  from?: never;
  event?: never;
};

export type JourneyLinearTransitions<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = readonly [TStepId, ...(TStepId | JourneyLinearStep<TContext, TStepId, TEvents, THandlers>)[]];

/** Input type for `createGraphJourney`. `transitions` is required and must be an object map. */
export type GraphJourneyDefinition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = {
  initial: TStepId;
  context: TContext;
  handlers?: THandlers;
  steps: Record<TStepId, JourneyStepDefinition<TContext, TStepId, TEvents, TStepMeta, THandlers>>;
  transitions: JourneyTransitionGraph<TContext, TStepId, TEvents, THandlers>;
};

export type JourneyTransitionsDefinition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  THandlers extends Record<string, unknown> = JourneyEmpty
> =
  | JourneyLinearTransitions<TContext, TStepId, TEvents, THandlers>
  | JourneyTransitionGraph<TContext, TStepId, TEvents, THandlers>;

/**
 * Required marker property whose *name* is the compile error surfaced when a
 * transition targets its own step. Attaching it to the offending edge (rather
 * than narrowing `to`) keeps step-id inference intact.
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
 * it cannot satisfy — surfacing a descriptive error at the `to`. Intended to be
 * intersected with a captured (`const`) definition via `NoInfer`, so it never
 * participates in type inference. Used by the `create*Journey` factories.
 */
export type AssertNoSelfTransitions<TDefinition> = TDefinition extends { transitions: infer TGraph }
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
