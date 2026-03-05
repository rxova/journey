import type {
  JourneyBuiltInFrom,
  JourneyEvent,
  JourneyEventPayloadMap,
  JourneyGoToStepByIdEventType,
  JourneyTerminal
} from "./journey.types";

/** Arguments passed to transition guards and effects. */
export type JourneyTransitionArgs<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
> = {
  context: TContext;
  from: TStepId;
  timeline: readonly TStepId[];
  index: number;
  event: JourneyEvent<TStepId, TEventType, TPayloadMap>;
};

/** Transition destination, either another step or a terminal machine state. */
export type JourneyTransitionTarget<TStepId extends string> = TStepId | JourneyTerminal;

type JourneyTransitionConfig<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
> = {
  id?: string;
  from: TStepId | JourneyBuiltInFrom;
  when?: (
    args: JourneyTransitionArgs<TContext, TStepId, TEventType, TPayloadMap>
  ) => boolean | Promise<boolean>;
  effect?: (
    args: JourneyTransitionArgs<TContext, TStepId, TEventType, TPayloadMap>
  ) => TContext | void | Promise<TContext | void>;
};

/** Transition declared for a standard event or terminal event. */
export type JourneyEventTransition<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
> =
  | (JourneyTransitionConfig<TContext, TStepId, TEventType, TPayloadMap> & {
      event: Exclude<TEventType, "completeJourney" | "terminateJourney">;
      to: JourneyTransitionTarget<TStepId>;
    })
  | (JourneyTransitionConfig<TContext, TStepId, TEventType, TPayloadMap> & {
      event: Extract<TEventType, "completeJourney" | "terminateJourney">;
      to?: never;
    });

/** Direct jump transition triggered by the built-in `goToStepById` event. */
export type JourneyGoToStepTransition<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
> = JourneyTransitionConfig<TContext, TStepId, TEventType, TPayloadMap> & {
  event: JourneyGoToStepByIdEventType;
  to: TStepId;
};

/** Any transition shape accepted by `createJourneyMachine`. */
export type JourneyTransition<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
> =
  | JourneyEventTransition<TContext, TStepId, TEventType, TPayloadMap>
  | JourneyGoToStepTransition<TContext, TStepId, TEventType, TPayloadMap>;

/** Optional transition behavior shared by direct and branch transitions. */
export type TransitionConfig<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
> = {
  id?: string;
  effect?: (
    args: JourneyTransitionArgs<TContext, TStepId, TEventType, TPayloadMap>
  ) => TContext | void | Promise<TContext | void>;
};

/** Branch definition used by `choose(...)`. */
export type TransitionBranch<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
> = TransitionConfig<TContext, TStepId, TEventType, TPayloadMap> & {
  to: JourneyTransitionTarget<TStepId>;
  when?: (
    args: JourneyTransitionArgs<TContext, TStepId, TEventType, TPayloadMap>
  ) => boolean | Promise<boolean>;
};

/** Builder returned by `tx.from(...).on(nonTerminalEvent)` and `tx.any().on(...)`. */
export type StandardEventBuilder<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
> = {
  to: (
    to: JourneyTransitionTarget<TStepId>,
    config?: TransitionConfig<TContext, TStepId, TEventType, TPayloadMap>
  ) => JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>;
  choose: (
    ...branches: Array<TransitionBranch<TContext, TStepId, TEventType, TPayloadMap>>
  ) => JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>[];
};

/** Builder returned by `tx.from(...).on("completeJourney")`. */
export type CompleteJourneyEventBuilder<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
> = {
  complete: (
    config?: TransitionConfig<TContext, TStepId, TEventType, TPayloadMap>
  ) => JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>;
};

/** Builder returned by `tx.from(...).on("terminateJourney")`. */
export type TerminateJourneyEventBuilder<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
> = {
  terminate: (
    config?: TransitionConfig<TContext, TStepId, TEventType, TPayloadMap>
  ) => JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>;
};

/**
 * Conditional transition builder returned by `tx.from(...).on(event)`:
 * terminal events expose terminal-only helpers, other events expose `to/choose`.
 */
export type EventBuilder<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
> = TEventType extends "completeJourney"
  ? CompleteJourneyEventBuilder<TContext, TStepId, TEventType, TPayloadMap>
  : TEventType extends "terminateJourney"
    ? TerminateJourneyEventBuilder<TContext, TStepId, TEventType, TPayloadMap>
    : StandardEventBuilder<TContext, TStepId, TEventType, TPayloadMap>;
