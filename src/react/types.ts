import type React from "react";

import type {
  FLOW_EVENT,
  FlowEvent,
  FlowEventPayloadMap as FlowCoreEventPayloadMap,
  FlowFlow,
  FlowMachine,
  FlowPayloadFor,
  FlowPersistenceOptions,
  FlowSnapshot
} from "@/src/core";

export type FlowDefaultEvent = "next" | "back" | "close" | "submit";

export type FlowEventType<TCustomEvent extends string = never> = FlowDefaultEvent | TCustomEvent;
export type FlowReactEventPayloadMap<TCustomEvent extends string = never> = FlowCoreEventPayloadMap<
  FlowEventType<TCustomEvent>
>;

export type FlowReactStep = {
  component: React.ComponentType;
};

export type FlowReactFlow<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends FlowReactEventPayloadMap<TCustomEvent> = Record<never, never>
> = Omit<FlowFlow<TContext, TStepId, FlowEventType<TCustomEvent>, TEventPayloadMap>, "steps"> & {
  steps: Record<TStepId, FlowReactStep>;
};

export type FlowApi<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends FlowReactEventPayloadMap<TCustomEvent> = Record<never, never>
> = {
  send: (event: FlowEvent<TStepId, FlowEventType<TCustomEvent>, TEventPayloadMap>) => Promise<void>;
  goTo: (
    stepId: TStepId,
    payload?: FlowPayloadFor<
      FlowEventType<TCustomEvent>,
      TEventPayloadMap,
      (typeof FLOW_EVENT)["GO_TO"]
    >
  ) => Promise<void>;
  next: (
    payload?: FlowPayloadFor<FlowEventType<TCustomEvent>, TEventPayloadMap, "next">
  ) => Promise<void>;
  back: (
    payload?: FlowPayloadFor<FlowEventType<TCustomEvent>, TEventPayloadMap, "back">
  ) => Promise<void>;
  close: (
    payload?: FlowPayloadFor<FlowEventType<TCustomEvent>, TEventPayloadMap, "close">
  ) => Promise<void>;
  submit: (
    payload?: FlowPayloadFor<FlowEventType<TCustomEvent>, TEventPayloadMap, "submit">
  ) => Promise<void>;
  updateContext: (updater: (context: TContext) => TContext) => void;
  reset: () => void;
};

export type FlowHookResult<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends FlowReactEventPayloadMap<TCustomEvent> = Record<never, never>
> = {
  snapshot: FlowSnapshot<TContext, TStepId>;
  api: FlowApi<TContext, TStepId, TCustomEvent, TEventPayloadMap>;
};

export type FlowStoreValue<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends FlowReactEventPayloadMap<TCustomEvent> = Record<never, never>
> = {
  machine: FlowMachine<TContext, TStepId, FlowEventType<TCustomEvent>, TEventPayloadMap>;
  flow: FlowReactFlow<TContext, TStepId, TCustomEvent, TEventPayloadMap>;
};

export type FlowProviderProps<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never,
  TEventPayloadMap extends FlowReactEventPayloadMap<TCustomEvent> = Record<never, never>
> = {
  flow: FlowReactFlow<TContext, TStepId, TCustomEvent, TEventPayloadMap>;
  machine?: FlowMachine<TContext, TStepId, FlowEventType<TCustomEvent>, TEventPayloadMap>;
  persistence?: FlowPersistenceOptions<TContext, TStepId>;
  children: React.ReactNode;
};
