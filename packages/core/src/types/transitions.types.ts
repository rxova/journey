import type {
  JOURNEY_EVENT,
  JourneyBuiltInFrom,
  JourneyEvent,
  JourneyEventPayloadMap,
  JourneyTerminal
} from "./journey.types";

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

export type JourneyGoToStepTransition<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
> = JourneyTransitionConfig<TContext, TStepId, TEventType, TPayloadMap> & {
  event: (typeof JOURNEY_EVENT)["GO_TO_STEP_BY_ID"];
  to: TStepId;
};

export type JourneyTransition<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
> =
  | JourneyEventTransition<TContext, TStepId, TEventType, TPayloadMap>
  | JourneyGoToStepTransition<TContext, TStepId, TEventType, TPayloadMap>;

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
