export const FLOW_TERMINAL = {
  COMPLETE: "COMPLETE",
  CLOSE: "CLOSE"
} as const;

export type FlowTerminal = (typeof FLOW_TERMINAL)[keyof typeof FLOW_TERMINAL];

export const HISTORY_TARGET = "__HISTORY__" as const;
export const FLOW_WILDCARD = "*" as const;

export const FLOW_EVENT = {
  GO_TO: "goTo"
} as const;

export type FlowBuiltInEvent = (typeof FLOW_EVENT)[keyof typeof FLOW_EVENT];
export type FlowBuiltInFrom = typeof FLOW_WILDCARD;

export type FlowBaseEvent = {
  type: string;
  payload?: unknown;
};

export type FlowEventPayloadMap<TEventType extends string> = Partial<
  Record<TEventType | FlowBuiltInEvent, unknown>
>;

export type FlowPayloadFor<
  TEventType extends string,
  TPayloadMap extends FlowEventPayloadMap<TEventType>,
  TEvent extends TEventType | FlowBuiltInEvent
> = TEvent extends keyof TPayloadMap ? TPayloadMap[TEvent] : unknown;

export type FlowGoToEvent<TStepId extends string, TPayload = unknown> = {
  type: (typeof FLOW_EVENT)["GO_TO"];
  to: TStepId;
  payload?: TPayload;
};

export type FlowEvent<
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends FlowEventPayloadMap<TEventType> = Record<never, never>
> =
  | FlowGoToEvent<TStepId, FlowPayloadFor<TEventType, TPayloadMap, (typeof FLOW_EVENT)["GO_TO"]>>
  | {
      [TType in TEventType]: {
        type: TType;
        payload?: FlowPayloadFor<TEventType, TPayloadMap, TType>;
      };
    }[TEventType];

export type FlowTransitionArgs<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends FlowEventPayloadMap<TEventType> = Record<never, never>
> = {
  context: TContext;
  from: TStepId;
  history: readonly TStepId[];
  event: FlowEvent<TStepId, TEventType, TPayloadMap>;
};

export type FlowTransitionTarget<TStepId extends string> =
  | TStepId
  | FlowTerminal
  | typeof HISTORY_TARGET;

export type FlowTransition<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends FlowEventPayloadMap<TEventType> = Record<never, never>
> = {
  id?: string;
  from: TStepId | FlowBuiltInFrom;
  event: TEventType | (typeof FLOW_EVENT)["GO_TO"];
  to: FlowTransitionTarget<TStepId>;
  when?: (
    args: FlowTransitionArgs<TContext, TStepId, TEventType, TPayloadMap>
  ) => boolean | Promise<boolean>;
  effect?: (
    args: FlowTransitionArgs<TContext, TStepId, TEventType, TPayloadMap>
  ) => TContext | void | Promise<TContext | void>;
};

export type FlowSnapshot<TContext, TStepId extends string> = {
  current: TStepId;
  context: TContext;
  history: readonly TStepId[];
  visited: readonly TStepId[];
  terminal: FlowTerminal | null;
  isDone: boolean;
};

export type FlowPersistedSnapshot<TContext, TStepId extends string> = {
  current: TStepId;
  context: TContext;
  history: readonly TStepId[];
  terminal: FlowTerminal | null;
};

export type FlowPersistedState<TContext, TStepId extends string> = {
  version: number;
  snapshot: FlowPersistedSnapshot<TContext, TStepId>;
};

export type FlowStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export type FlowPersistenceOptions<TContext, TStepId extends string> = {
  key: string;
  storage?: FlowStorage;
  version?: number;
  clearOnReset?: boolean;
  serialize?: (value: FlowPersistedState<TContext, TStepId>) => string;
  deserialize?: (value: string) => unknown;
  migrate?: (value: unknown, persistedVersion: number) => FlowPersistedSnapshot<TContext, TStepId>;
  onError?: (error: unknown) => void;
};

export type FlowFlow<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends FlowEventPayloadMap<TEventType> = Record<never, never>
> = {
  initial: TStepId;
  context: TContext;
  steps: Record<TStepId, unknown>;
  transitions: readonly FlowTransition<TContext, TStepId, TEventType, TPayloadMap>[];
};

export type FlowMachineOptions<TContext, TStepId extends string> = {
  persistence?: FlowPersistenceOptions<TContext, TStepId>;
};

export type FlowSendResult<TContext, TStepId extends string> = {
  transitioned: boolean;
  transitionId?: string;
  snapshot: FlowSnapshot<TContext, TStepId>;
};

export type FlowMachine<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends FlowEventPayloadMap<TEventType> = Record<never, never>
> = {
  getSnapshot: () => FlowSnapshot<TContext, TStepId>;
  send: (
    event: FlowEvent<TStepId, TEventType, TPayloadMap>
  ) => Promise<FlowSendResult<TContext, TStepId>>;
  updateContext: (updater: (context: TContext) => TContext) => FlowSnapshot<TContext, TStepId>;
  reset: () => FlowSnapshot<TContext, TStepId>;
  subscribe: (listener: () => void) => () => void;
};
