export const FLOW_TERMINAL = {
  COMPLETE: "COMPLETE",
  CLOSE: "CLOSE"
} as const;

export type FlowTerminal = (typeof FLOW_TERMINAL)[keyof typeof FLOW_TERMINAL];

export const HISTORY_TARGET = "__HISTORY__" as const;

export type FlowBaseEvent = {
  type: string;
  payload?: unknown;
};

export type FlowGoToEvent<TStepId extends string> = {
  type: "goTo";
  to: TStepId;
  payload?: unknown;
};

export type FlowEvent<TStepId extends string, TEventType extends string> =
  | FlowGoToEvent<TStepId>
  | {
      type: TEventType;
      payload?: unknown;
    };

export type FlowTransitionArgs<TContext, TStepId extends string, TEventType extends string> = {
  context: TContext;
  from: TStepId;
  history: readonly TStepId[];
  event: FlowEvent<TStepId, TEventType>;
};

export type FlowTransitionTarget<TStepId extends string> =
  | TStepId
  | FlowTerminal
  | typeof HISTORY_TARGET;

export type FlowTransition<TContext, TStepId extends string, TEventType extends string> = {
  id?: string;
  from: TStepId | "*";
  event: TEventType | "goTo";
  to: FlowTransitionTarget<TStepId>;
  when?: (args: FlowTransitionArgs<TContext, TStepId, TEventType>) => boolean | Promise<boolean>;
  effect?: (
    args: FlowTransitionArgs<TContext, TStepId, TEventType>
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

export type FlowFlow<TContext, TStepId extends string, TEventType extends string> = {
  initial: TStepId;
  context: TContext;
  steps: Record<TStepId, unknown>;
  transitions: readonly FlowTransition<TContext, TStepId, TEventType>[];
};

export type FlowMachineOptions<TContext, TStepId extends string> = {
  persistence?: FlowPersistenceOptions<TContext, TStepId>;
};

export type FlowSendResult<TContext, TStepId extends string> = {
  transitioned: boolean;
  transitionId?: string;
  snapshot: FlowSnapshot<TContext, TStepId>;
};

export type FlowMachine<TContext, TStepId extends string, TEventType extends string> = {
  getSnapshot: () => FlowSnapshot<TContext, TStepId>;
  send: (event: FlowEvent<TStepId, TEventType>) => Promise<FlowSendResult<TContext, TStepId>>;
  updateContext: (updater: (context: TContext) => TContext) => FlowSnapshot<TContext, TStepId>;
  reset: () => FlowSnapshot<TContext, TStepId>;
  subscribe: (listener: () => void) => () => void;
};
