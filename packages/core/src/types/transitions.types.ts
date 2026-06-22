import type {
  JourneyBuiltInFrom,
  JourneyEvent,
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
  TEventMap extends Record<string, unknown>,
  TEventType extends JourneyFullEventType<TEventMap>
> = TEventType extends "goToStepById"
  ? JourneyGoToEvent<TStepId, JourneyPayloadFor<TEventMap, "goToStepById">>
  : {
      type: TEventType;
      payload?: JourneyPayloadFor<TEventMap, TEventType>;
    };

export type JourneyDispatch<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>
> = (event: JourneySendEvent<TStepId, TEventMap>) => Promise<JourneySendResult<TContext, TStepId>>;

export type JourneyLifecycleArgs<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
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
  dispatch: JourneyDispatch<TContext, TStepId, TEventMap>;
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
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>
> = JourneyBivariantCallback<
  JourneyLifecycleArgs<TContext, TStepId, TEventMap, THandlers>,
  void | Promise<void>
>;

export type JourneyTransitionArgs<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = JourneyEmpty,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = JourneyTransitionArgsBase<TContext, TStepId, THandlers> & {
  event: JourneyEvent<TStepId, TEventMap>;
};

export type JourneyTransitionArgsForEvent<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>,
  TEventType extends JourneyFullEventType<TEventMap>
> = JourneyTransitionArgsBase<TContext, TStepId, THandlers> & {
  event: JourneyTransitionEventOfType<TStepId, TEventMap, TEventType>;
};

export type JourneyTransitionUpdateContextArgsForEvent<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TEventType extends JourneyFullEventType<TEventMap>
> = {
  snapshot: JourneySnapshot<TContext, TStepId>;
  context: Readonly<TContext>;
  from: TStepId;
  timeline: JourneyHistory<TStepId>["timeline"];
  index: number;
  event: JourneyTransitionEventOfType<TStepId, TEventMap, TEventType>;
};

type JourneyStepTransitionEventType<TEventMap extends Record<string, unknown>> = Exclude<
  JourneyFullEventType<TEventMap>,
  "completeJourney" | "terminateJourney" | "goToStepById"
>;

type JourneyTerminalTransitionEventType<TEventMap extends Record<string, unknown>> = Extract<
  JourneyFullEventType<TEventMap>,
  "completeJourney" | "terminateJourney"
>;

export type JourneyTransitionTarget<TStepId extends string> = TStepId | JourneyTerminal;

type JourneyTransitionBehavior<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>,
  TEventType extends JourneyFullEventType<TEventMap>
> = {
  label?: string;
  timeoutMs?: number;
  when?: JourneyBivariantCallback<
    JourneyTransitionArgsForEvent<TContext, TStepId, TEventMap, THandlers, TEventType>,
    boolean | Promise<boolean>
  >;
  updateContext?: JourneyBivariantCallback<
    JourneyTransitionUpdateContextArgsForEvent<TContext, TStepId, TEventMap, TEventType>,
    TContext
  >;
  onEnter?: JourneyStepLifecycleCallback<TContext, TStepId, TEventMap, THandlers>;
  onLeave?: JourneyStepLifecycleCallback<TContext, TStepId, TEventMap, THandlers>;
};

type JourneyTransitionConfig<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>,
  TEventType extends JourneyFullEventType<TEventMap>
> = JourneyTransitionBehavior<TContext, TStepId, TEventMap, THandlers, TEventType> & {
  from: TStepId | JourneyBuiltInFrom;
};

export type JourneyStepEventTransition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = JourneyEmpty,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TEventType extends JourneyStepTransitionEventType<TEventMap> =
    JourneyStepTransitionEventType<TEventMap>
> = {
  [TSelectedEvent in TEventType]: JourneyTransitionConfig<
    TContext,
    TStepId,
    TEventMap,
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
  TEventMap extends Record<string, unknown> = JourneyEmpty,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TEventType extends JourneyTerminalTransitionEventType<TEventMap> =
    JourneyTerminalTransitionEventType<TEventMap>
> = {
  [TSelectedEvent in TEventType]: JourneyTransitionConfig<
    TContext,
    TStepId,
    TEventMap,
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
  TEventMap extends Record<string, unknown> = JourneyEmpty,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = JourneyTransitionConfig<TContext, TStepId, TEventMap, THandlers, "goToStepById"> & {
  event: "goToStepById";
  to: TStepId;
};

export type JourneyTransition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = JourneyEmpty,
  THandlers extends Record<string, unknown> = JourneyEmpty
> =
  | JourneyStepEventTransition<TContext, TStepId, TEventMap, THandlers>
  | JourneyTerminalTransition<TContext, TStepId, TEventMap, THandlers>
  | JourneyGoToStepTransition<TContext, TStepId, TEventMap, THandlers>;

export type JourneyResolvedTransition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = JourneyEmpty,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = JourneyTransition<TContext, TStepId, TEventMap, THandlers> & {
  id: string;
  label?: string;
};

export type JourneyGlobalTransition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = JourneyEmpty,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = JourneyTransition<TContext, TStepId, TEventMap, THandlers> & {
  from: JourneyBuiltInFrom;
};

export type JourneyStepEventGraphEdge<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = JourneyEmpty,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TEventType extends JourneyStepTransitionEventType<TEventMap> =
    JourneyStepTransitionEventType<TEventMap>
> = {
  [TSelectedEvent in TEventType]: JourneyTransitionBehavior<
    TContext,
    TStepId,
    TEventMap,
    THandlers,
    TSelectedEvent
  > & {
    to: JourneyTransitionTarget<TStepId>;
  };
}[TEventType];

export type JourneyTerminalGraphEdge<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = JourneyEmpty,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TEventType extends JourneyTerminalTransitionEventType<TEventMap> =
    JourneyTerminalTransitionEventType<TEventMap>
> = {
  [TSelectedEvent in TEventType]: JourneyTransitionBehavior<
    TContext,
    TStepId,
    TEventMap,
    THandlers,
    TSelectedEvent
  > & {
    to?: never;
  };
}[TEventType];

export type JourneyGoToStepGraphEdge<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = JourneyEmpty,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = JourneyTransitionBehavior<TContext, TStepId, TEventMap, THandlers, "goToStepById"> & {
  to: TStepId;
};

export type JourneyGraphEdge<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = JourneyEmpty,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TEventType extends JourneyFullEventType<TEventMap> = JourneyFullEventType<TEventMap>
> =
  | JourneyStepEventGraphEdge<
      TContext,
      TStepId,
      TEventMap,
      THandlers,
      Extract<TEventType, JourneyStepTransitionEventType<TEventMap>>
    >
  | JourneyTerminalGraphEdge<
      TContext,
      TStepId,
      TEventMap,
      THandlers,
      Extract<TEventType, JourneyTerminalTransitionEventType<TEventMap>>
    >
  | (Extract<TEventType, "goToStepById"> extends never
      ? never
      : JourneyGoToStepGraphEdge<TContext, TStepId, TEventMap, THandlers>);

export type JourneyTerminalTransitionShorthand<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>,
  TEventType extends JourneyTerminalTransitionEventType<TEventMap>
> =
  | true
  | readonly []
  | readonly JourneyGraphEdge<TContext, TStepId, TEventMap, THandlers, TEventType>[];

export type JourneyStepTransitions<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = JourneyEmpty,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = Partial<{
  [TSelectedEvent in JourneyFullEventType<TEventMap>]: TSelectedEvent extends
    | "completeJourney"
    | "terminateJourney"
    ? JourneyTerminalTransitionShorthand<
        TContext,
        TStepId,
        TEventMap,
        THandlers,
        Extract<TSelectedEvent, JourneyTerminalTransitionEventType<TEventMap>>
      >
    : readonly JourneyGraphEdge<TContext, TStepId, TEventMap, THandlers, TSelectedEvent>[];
}>;

export type JourneyGlobalKey = "global";

export type JourneyTransitionGraph<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = JourneyEmpty,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = Partial<Record<TStepId, JourneyStepTransitions<TContext, TStepId, TEventMap, THandlers>>> & {
  global?: JourneyStepTransitions<TContext, TStepId, TEventMap, THandlers>;
};

export type JourneyLinearStep<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = JourneyEmpty,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = JourneyTransitionBehavior<TContext, TStepId, TEventMap, THandlers, "goToNextStep"> & {
  step: TStepId;
  when?: never;
  to?: never;
  from?: never;
  event?: never;
};

export type JourneyLinearTransitions<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = JourneyEmpty,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = readonly [TStepId, ...(TStepId | JourneyLinearStep<TContext, TStepId, TEventMap, THandlers>)[]];

/** Input type for `createGraphJourney`. `transitions` is required and must be an object map. */
export type GraphJourneyDefinition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = JourneyEmpty,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = {
  initial: TStepId;
  context: TContext;
  handlers?: THandlers;
  steps: Record<TStepId, JourneyStepDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>>;
  transitions: JourneyTransitionGraph<TContext, TStepId, TEventMap, THandlers>;
};

export type JourneyTransitionsDefinition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = JourneyEmpty,
  THandlers extends Record<string, unknown> = JourneyEmpty
> =
  | JourneyLinearTransitions<TContext, TStepId, TEventMap, THandlers>
  | JourneyTransitionGraph<TContext, TStepId, TEventMap, THandlers>;

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
