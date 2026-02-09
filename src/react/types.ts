import type React from "react";

import type {
  FlowEvent,
  FlowFlow,
  FlowMachine,
  FlowSnapshot
} from "../core";

export type FlowReactStep = {
  component: React.ComponentType;
};

export type FlowReactFlow<
  TContext,
  TStepId extends string,
  TEventType extends string
> = Omit<FlowFlow<TContext, TStepId, TEventType>, "steps"> & {
  steps: Record<TStepId, FlowReactStep>;
};

export type FlowApi<TContext, TStepId extends string, TEventType extends string> = {
  send: (event: FlowEvent<TStepId, TEventType>) => Promise<void>;
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
  TEventType extends string
> = {
  snapshot: FlowSnapshot<TContext, TStepId>;
  api: FlowApi<TContext, TStepId, TEventType>;
};

export type FlowStoreValue<
  TContext,
  TStepId extends string,
  TEventType extends string
> = {
  machine: FlowMachine<TContext, TStepId, TEventType>;
  flow: FlowReactFlow<TContext, TStepId, TEventType>;
};
