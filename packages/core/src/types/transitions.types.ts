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

type JourneySelectedTransitionEvent<
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
> = Extract<JourneyEvent<TStepId, TEventType, TPayloadMap>, { type: TEventType }>;

/** Arguments passed to fluent transition guards and effects for a selected event type. */
export type JourneySelectedTransitionArgs<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
> = Omit<JourneyTransitionArgs<TContext, TStepId, TEventType, TPayloadMap>, "event"> & {
  event: JourneySelectedTransitionEvent<TStepId, TEventType, TPayloadMap>;
};

export type JourneyTransitionPayloadMap<
  TEventType extends string,
  TPayloadMap extends Partial<Record<string, unknown>>
> = TPayloadMap & JourneyEventPayloadMap<TEventType>;

/** Transition destination, either another step or a terminal machine state. */
export type JourneyTransitionTarget<TStepId extends string> = TStepId | JourneyTerminal;

type JourneyTransitionConfig<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends Partial<Record<string, unknown>> = Record<never, never>
> = {
  id?: string;
  timeoutMs?: number;
  from: TStepId | JourneyBuiltInFrom;
  when?: (
    args: JourneySelectedTransitionArgs<
      TContext,
      TStepId,
      TEventType,
      JourneyTransitionPayloadMap<TEventType, TPayloadMap>
    >
  ) => boolean | Promise<boolean>;
  effect?: (
    args: JourneySelectedTransitionArgs<
      TContext,
      TStepId,
      TEventType,
      JourneyTransitionPayloadMap<TEventType, TPayloadMap>
    >
  ) => TContext | void | Promise<TContext | void>;
};

/** Transition declared for a standard event or terminal event. */
export type JourneyEventTransition<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
> =
  | {
      [TSelectedEvent in Exclude<
        TEventType,
        "completeJourney" | "terminateJourney"
      >]: JourneyTransitionConfig<TContext, TStepId, TSelectedEvent, TPayloadMap> & {
        event: TSelectedEvent;
        to: JourneyTransitionTarget<TStepId>;
      };
    }[Exclude<TEventType, "completeJourney" | "terminateJourney">]
  | {
      [TSelectedEvent in Extract<
        TEventType,
        "completeJourney" | "terminateJourney"
      >]: JourneyTransitionConfig<TContext, TStepId, TSelectedEvent, TPayloadMap> & {
        event: TSelectedEvent;
        to?: never;
      };
    }[Extract<TEventType, "completeJourney" | "terminateJourney">];

/** Direct jump transition triggered by the built-in `goToStepById` event. */
export type JourneyGoToStepTransition<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
> = JourneyTransitionConfig<TContext, TStepId, JourneyGoToStepByIdEventType, TPayloadMap> & {
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
  timeoutMs?: number;
  effect?: (
    args: JourneySelectedTransitionArgs<TContext, TStepId, TEventType, TPayloadMap>
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
    args: JourneySelectedTransitionArgs<TContext, TStepId, TEventType, TPayloadMap>
  ) => boolean | Promise<boolean>;
};

/** Builder returned by fluent `when(...)` / `otherwise()` helpers for a selected event type. */
export type TransitionBranchBuilder<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
> = {
  to: (
    to: JourneyTransitionTarget<TStepId>,
    config?: TransitionConfig<TContext, TStepId, TEventType, TPayloadMap>
  ) => TransitionBranch<TContext, TStepId, TEventType, TPayloadMap>;
};

/** Builder-local helpers passed to callback-based `choose(...)` declarations. */
export type TransitionChoiceHelpers<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
> = {
  when: (
    predicate: (
      args: JourneySelectedTransitionArgs<TContext, TStepId, TEventType, TPayloadMap>
    ) => boolean | Promise<boolean>
  ) => TransitionBranchBuilder<TContext, TStepId, TEventType, TPayloadMap>;
  otherwise: () => TransitionBranchBuilder<TContext, TStepId, TEventType, TPayloadMap>;
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
    ...input:
      | Array<TransitionBranch<TContext, TStepId, TEventType, TPayloadMap>>
      | [
          factory: (
            helpers: TransitionChoiceHelpers<TContext, TStepId, TEventType, TPayloadMap>
          ) => readonly TransitionBranch<TContext, TStepId, TEventType, TPayloadMap>[]
        ]
  ) => JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>[];
  when: (
    predicate: (
      args: JourneySelectedTransitionArgs<TContext, TStepId, TEventType, TPayloadMap>
    ) => boolean | Promise<boolean>
  ) => TransitionBranchBuilder<TContext, TStepId, TEventType, TPayloadMap>;
  otherwise: () => TransitionBranchBuilder<TContext, TStepId, TEventType, TPayloadMap>;
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

export type JourneyTransitionItem<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
> =
  | JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>
  | readonly JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>[];

export type JourneyCreateTransitions<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
> = (
  ...items: Array<JourneyTransitionItem<TContext, TStepId, TEventType, TPayloadMap>>
) => JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>[];

export type JourneyTypedTx<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends Partial<Record<string, unknown>> = Record<never, never>
> = {
  from: (from: TStepId) => {
    on: <TSelectedEvent extends TEventType>(
      event: TSelectedEvent
    ) => EventBuilder<
      TContext,
      TStepId,
      TSelectedEvent,
      JourneyTransitionPayloadMap<TSelectedEvent, TPayloadMap>
    >;
    toComplete: (
      config?: TransitionConfig<
        TContext,
        TStepId,
        "completeJourney",
        JourneyTransitionPayloadMap<"completeJourney", TPayloadMap>
      >
    ) => JourneyEventTransition<
      TContext,
      TStepId,
      "completeJourney",
      JourneyTransitionPayloadMap<"completeJourney", TPayloadMap>
    >;
    toTerminate: (
      config?: TransitionConfig<
        TContext,
        TStepId,
        "terminateJourney",
        JourneyTransitionPayloadMap<"terminateJourney", TPayloadMap>
      >
    ) => JourneyEventTransition<
      TContext,
      TStepId,
      "terminateJourney",
      JourneyTransitionPayloadMap<"terminateJourney", TPayloadMap>
    >;
  };
  any: () => {
    on: <TSelectedEvent extends TEventType>(
      event: TSelectedEvent
    ) => EventBuilder<
      TContext,
      TStepId,
      TSelectedEvent,
      JourneyTransitionPayloadMap<TSelectedEvent, TPayloadMap>
    >;
    toComplete: (
      config?: TransitionConfig<
        TContext,
        TStepId,
        "completeJourney",
        JourneyTransitionPayloadMap<"completeJourney", TPayloadMap>
      >
    ) => JourneyEventTransition<
      TContext,
      TStepId,
      "completeJourney",
      JourneyTransitionPayloadMap<"completeJourney", TPayloadMap>
    >;
    toTerminate: (
      config?: TransitionConfig<
        TContext,
        TStepId,
        "terminateJourney",
        JourneyTransitionPayloadMap<"terminateJourney", TPayloadMap>
      >
    ) => JourneyEventTransition<
      TContext,
      TStepId,
      "terminateJourney",
      JourneyTransitionPayloadMap<"terminateJourney", TPayloadMap>
    >;
  };
  when: (
    predicate: (
      args: JourneySelectedTransitionArgs<
        TContext,
        TStepId,
        TEventType,
        JourneyTransitionPayloadMap<TEventType, TPayloadMap>
      >
    ) => boolean | Promise<boolean>
  ) => TransitionBranchBuilder<
    TContext,
    TStepId,
    TEventType,
    JourneyTransitionPayloadMap<TEventType, TPayloadMap>
  >;
  otherwise: () => TransitionBranchBuilder<
    TContext,
    TStepId,
    TEventType,
    JourneyTransitionPayloadMap<TEventType, TPayloadMap>
  >;
};

export type JourneyTransitionHelpers<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
> = {
  tx: JourneyTypedTx<TContext, TStepId, TEventType, TPayloadMap>;
  createTransitions: JourneyCreateTransitions<TContext, TStepId, TEventType, TPayloadMap>;
};

export type JourneyTransitionsFactory<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
> = (
  helpers: JourneyTransitionHelpers<TContext, TStepId, TEventType, TPayloadMap>
) => readonly JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>[];

export type JourneyTransitionsInput<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
> =
  | readonly JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>[]
  | JourneyTransitionsFactory<TContext, TStepId, TEventType, TPayloadMap>;
