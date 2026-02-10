import type React from "react";

import type {
  JOURNEY_EVENT,
  JourneyEvent,
  JourneyEventPayloadMap as JourneyCoreEventPayloadMap,
  JourneyDefinition,
  JourneyMachine,
  JourneyPayloadFor,
  JourneyPersistenceOptions,
  JourneyHistoryOptions,
  JourneySnapshot
} from "@/src/core";

export type JourneyDefaultEvent = "next" | "back" | "close" | "submit";

export type JourneyEventType<TCustomEvent extends string = never> =
  | JourneyDefaultEvent
  | TCustomEvent;
export type JourneyReactEventPayloadMap<TCustomEvent extends string = never> =
  JourneyCoreEventPayloadMap<JourneyEventType<TCustomEvent>>;

export type JourneyReactStep = {
  component: React.ComponentType;
};

export type JourneyReactDefinition<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>
> = Omit<
  JourneyDefinition<TContext, TStepId, JourneyEventType<TCustomEvent>, TEventPayloadMap>,
  "steps"
> & {
  steps: Record<TStepId, JourneyReactStep>;
};

export type JourneyApi<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>
> = {
  send: (
    event: JourneyEvent<TStepId, JourneyEventType<TCustomEvent>, TEventPayloadMap>
  ) => Promise<void>;
  goTo: (
    stepId: TStepId,
    payload?: JourneyPayloadFor<
      JourneyEventType<TCustomEvent>,
      TEventPayloadMap,
      (typeof JOURNEY_EVENT)["GO_TO"]
    >
  ) => Promise<void>;
  next: (
    payload?: JourneyPayloadFor<JourneyEventType<TCustomEvent>, TEventPayloadMap, "next">
  ) => Promise<void>;
  back: (
    payload?: JourneyPayloadFor<JourneyEventType<TCustomEvent>, TEventPayloadMap, "back">
  ) => Promise<void>;
  close: (
    payload?: JourneyPayloadFor<JourneyEventType<TCustomEvent>, TEventPayloadMap, "close">
  ) => Promise<void>;
  submit: (
    payload?: JourneyPayloadFor<JourneyEventType<TCustomEvent>, TEventPayloadMap, "submit">
  ) => Promise<void>;
  clearStepError: (stepId?: TStepId) => void;
  updateContext: (updater: (context: TContext) => TContext) => void;
  reset: () => void;
  trimHistory: (maxHistory?: number) => void;
  clearHistory: () => void;
};

export type JourneyHookResult<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>
> = {
  snapshot: JourneySnapshot<TContext, TStepId>;
  api: JourneyApi<TContext, TStepId, TCustomEvent, TEventPayloadMap>;
};

export type JourneyStoreValue<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>
> = {
  machine: JourneyMachine<TContext, TStepId, JourneyEventType<TCustomEvent>, TEventPayloadMap>;
  journey: JourneyReactDefinition<TContext, TStepId, TCustomEvent, TEventPayloadMap>;
};

export type JourneyProviderProps<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends JourneyReactEventPayloadMap<TCustomEvent> = Record<never, never>
> = {
  journey: JourneyReactDefinition<TContext, TStepId, TCustomEvent, TEventPayloadMap>;
  machine?: JourneyMachine<TContext, TStepId, JourneyEventType<TCustomEvent>, TEventPayloadMap>;
  persistence?: JourneyPersistenceOptions<TContext, TStepId>;
  history?: JourneyHistoryOptions<TStepId>;
  resetOnJourneyChange?: boolean;
  children: React.ReactNode;
};
