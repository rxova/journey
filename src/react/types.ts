import type React from "react";

import type {
  FlowEvent,
  FlowFlow,
  FlowMachine,
  FlowPersistenceOptions,
  FlowSnapshot
} from "@/src/core";

export type FlowDefaultEvent = "next" | "back" | "close" | "submit";

export type FlowEventType<TCustomEvent extends string = never> = FlowDefaultEvent | TCustomEvent;

export type FlowReactStep = {
  component: React.ComponentType;
};

export type FlowReactFlow<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never
> = Omit<FlowFlow<TContext, TStepId, FlowEventType<TCustomEvent>>, "steps"> & {
  steps: Record<TStepId, FlowReactStep>;
};

export type FlowApi<TContext, TStepId extends string, TCustomEvent extends string = never> = {
  send: (event: FlowEvent<TStepId, FlowEventType<TCustomEvent>>) => Promise<void>;
  goTo: (stepId: TStepId, payload?: unknown) => Promise<void>;
  next: (payload?: unknown) => Promise<void>;
  back: (payload?: unknown) => Promise<void>;
  close: (payload?: unknown) => Promise<void>;
  submit: (payload?: unknown) => Promise<void>;
  updateContext: (updater: (context: TContext) => TContext) => void;
  reset: () => void;
};

export type FlowHookResult<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never
> = {
  snapshot: FlowSnapshot<TContext, TStepId>;
  api: FlowApi<TContext, TStepId, TCustomEvent>;
};

export type FlowStoreValue<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never
> = {
  machine: FlowMachine<TContext, TStepId, FlowEventType<TCustomEvent>>;
  flow: FlowReactFlow<TContext, TStepId, TCustomEvent>;
};

export type FlowProviderProps<
  TContext,
  TStepId extends string,
  TCustomEvent extends string = never
> = {
  flow: FlowReactFlow<TContext, TStepId, TCustomEvent>;
  machine?: FlowMachine<TContext, TStepId, FlowEventType<TCustomEvent>>;
  persistence?: FlowPersistenceOptions<TContext, TStepId>;
  children: React.ReactNode;
};
