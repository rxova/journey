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
  JourneyTerminal
} from "./journey.types";

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
  TEventMap extends Record<string, unknown> = Record<never, never>,
  THandlers extends Record<string, unknown> = Record<never, never>
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
  TEventMap extends Record<string, unknown> = Record<never, never>,
  THandlers extends Record<string, unknown> = Record<never, never>,
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
  TEventMap extends Record<string, unknown> = Record<never, never>,
  THandlers extends Record<string, unknown> = Record<never, never>,
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
  TEventMap extends Record<string, unknown> = Record<never, never>,
  THandlers extends Record<string, unknown> = Record<never, never>
> = JourneyTransitionConfig<TContext, TStepId, TEventMap, THandlers, "goToStepById"> & {
  event: "goToStepById";
  to: TStepId;
};

export type JourneyTransition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  THandlers extends Record<string, unknown> = Record<never, never>
> =
  | JourneyStepEventTransition<TContext, TStepId, TEventMap, THandlers>
  | JourneyTerminalTransition<TContext, TStepId, TEventMap, THandlers>
  | JourneyGoToStepTransition<TContext, TStepId, TEventMap, THandlers>;

export type JourneyResolvedTransition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  THandlers extends Record<string, unknown> = Record<never, never>
> = JourneyTransition<TContext, TStepId, TEventMap, THandlers> & {
  id: string;
  label?: string;
};

export type JourneyGlobalTransition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  THandlers extends Record<string, unknown> = Record<never, never>
> = JourneyTransition<TContext, TStepId, TEventMap, THandlers> & {
  from: JourneyBuiltInFrom;
};

export type JourneyStepEventGraphEdge<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  THandlers extends Record<string, unknown> = Record<never, never>,
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
  TEventMap extends Record<string, unknown> = Record<never, never>,
  THandlers extends Record<string, unknown> = Record<never, never>,
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
  TEventMap extends Record<string, unknown> = Record<never, never>,
  THandlers extends Record<string, unknown> = Record<never, never>
> = JourneyTransitionBehavior<TContext, TStepId, TEventMap, THandlers, "goToStepById"> & {
  to: TStepId;
};

export type JourneyGraphEdge<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  THandlers extends Record<string, unknown> = Record<never, never>,
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
  TEventMap extends Record<string, unknown> = Record<never, never>,
  THandlers extends Record<string, unknown> = Record<never, never>
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
  TEventMap extends Record<string, unknown> = Record<never, never>,
  THandlers extends Record<string, unknown> = Record<never, never>
> = Partial<Record<TStepId, JourneyStepTransitions<TContext, TStepId, TEventMap, THandlers>>> & {
  global?: JourneyStepTransitions<TContext, TStepId, TEventMap, THandlers>;
};

export type JourneyLinearStep<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  THandlers extends Record<string, unknown> = Record<never, never>
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
  TEventMap extends Record<string, unknown> = Record<never, never>,
  THandlers extends Record<string, unknown> = Record<never, never>
> = readonly [TStepId, ...(TStepId | JourneyLinearStep<TContext, TStepId, TEventMap, THandlers>)[]];

export type JourneyTransitionsDefinition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  THandlers extends Record<string, unknown> = Record<never, never>
> =
  | JourneyLinearTransitions<TContext, TStepId, TEventMap, THandlers>
  | JourneyTransitionGraph<TContext, TStepId, TEventMap, THandlers>;
