export const JOURNEY_TERMINAL = {
  COMPLETE: "COMPLETE",
  CLOSE: "CLOSE"
} as const;

export type JourneyTerminal = (typeof JOURNEY_TERMINAL)[keyof typeof JOURNEY_TERMINAL];

export const JOURNEY_STATUS = {
  RUNNING: "running",
  COMPLETE: "complete",
  CLOSED: "closed"
} as const;

export type JourneyStatus = (typeof JOURNEY_STATUS)[keyof typeof JOURNEY_STATUS];

export const HISTORY_TARGET = "__HISTORY__" as const;
export const JOURNEY_WILDCARD = "*" as const;

export const JOURNEY_EVENT = {
  GO_TO: "goTo"
} as const;

export type JourneyBuiltInEvent = (typeof JOURNEY_EVENT)[keyof typeof JOURNEY_EVENT];
export type JourneyBuiltInFrom = typeof JOURNEY_WILDCARD;

export const JOURNEY_ASYNC_PHASE = {
  IDLE: "idle",
  EVALUATING_WHEN: "evaluating-when",
  RUNNING_EFFECT: "running-effect",
  ERROR: "error"
} as const;

export type JourneyAsyncPhase = (typeof JOURNEY_ASYNC_PHASE)[keyof typeof JOURNEY_ASYNC_PHASE];

export type JourneyStepAsyncState = {
  phase: JourneyAsyncPhase;
  eventType: string | null;
  transitionId: string | null;
  error: unknown | null;
};

export type JourneyAsyncState<TStepId extends string> = {
  isLoading: boolean;
  byStep: Record<TStepId, JourneyStepAsyncState>;
};

export type JourneyBaseEvent = {
  type: string;
  payload?: unknown;
};

export type JourneyEventPayloadMap<TEventType extends string> = Partial<
  Record<TEventType | JourneyBuiltInEvent, unknown>
>;

export type JourneyPayloadFor<
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>,
  TEvent extends TEventType | JourneyBuiltInEvent
> = TEvent extends keyof TPayloadMap ? TPayloadMap[TEvent] : unknown;

export type JourneyGoToEvent<TStepId extends string, TPayload = unknown> = {
  type: (typeof JOURNEY_EVENT)["GO_TO"];
  to: TStepId;
  payload?: TPayload;
};

export type JourneyEvent<
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
> =
  | JourneyGoToEvent<
      TStepId,
      JourneyPayloadFor<TEventType, TPayloadMap, (typeof JOURNEY_EVENT)["GO_TO"]>
    >
  | {
      [TType in TEventType]: {
        type: TType;
        payload?: JourneyPayloadFor<TEventType, TPayloadMap, TType>;
      };
    }[TEventType];

export type JourneyTransitionArgs<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
> = {
  context: TContext;
  from: TStepId;
  history: readonly TStepId[];
  event: JourneyEvent<TStepId, TEventType, TPayloadMap>;
};

export type JourneyTransitionTarget<TStepId extends string> =
  | TStepId
  | JourneyTerminal
  | typeof HISTORY_TARGET;

export type JourneyTransition<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
> = {
  id?: string;
  from: TStepId | JourneyBuiltInFrom;
  event: TEventType | (typeof JOURNEY_EVENT)["GO_TO"];
  to: JourneyTransitionTarget<TStepId>;
  when?: (
    args: JourneyTransitionArgs<TContext, TStepId, TEventType, TPayloadMap>
  ) => boolean | Promise<boolean>;
  effect?: (
    args: JourneyTransitionArgs<TContext, TStepId, TEventType, TPayloadMap>
  ) => TContext | void | Promise<TContext | void>;
};

export type JourneySnapshot<TContext, TStepId extends string> = {
  current: TStepId;
  context: TContext;
  history: readonly TStepId[];
  visited: readonly TStepId[];
  status: JourneyStatus;
  async: JourneyAsyncState<TStepId>;
};

export type JourneyPersistedSnapshot<TContext, TStepId extends string> = {
  current: TStepId;
  context: TContext;
  history: readonly TStepId[];
  status: JourneyStatus;
};

export type JourneyPersistedState<TContext, TStepId extends string> = {
  version: number;
  snapshot: JourneyPersistedSnapshot<TContext, TStepId>;
};

export type JourneyStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export type JourneyPersistenceOptions<TContext, TStepId extends string> = {
  key: string;
  storage?: JourneyStorage;
  version?: number;
  clearOnReset?: boolean;
  serialize?: (value: JourneyPersistedState<TContext, TStepId>) => string;
  deserialize?: (value: string) => unknown;
  migrate?: (
    value: unknown,
    persistedVersion: number
  ) => JourneyPersistedSnapshot<TContext, TStepId>;
  onError?: (error: unknown) => void;
};

export type JourneyDefinition<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
> = {
  initial: TStepId;
  context: TContext;
  steps: Record<TStepId, unknown>;
  transitions: readonly JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>[];
};

export type JourneyMachineOptions<TContext, TStepId extends string> = {
  persistence?: JourneyPersistenceOptions<TContext, TStepId>;
};

export type JourneySendResult<TContext, TStepId extends string> = {
  transitioned: boolean;
  transitionId?: string;
  snapshot: JourneySnapshot<TContext, TStepId>;
};

export type JourneyMachine<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
> = {
  getSnapshot: () => JourneySnapshot<TContext, TStepId>;
  send: (
    event: JourneyEvent<TStepId, TEventType, TPayloadMap>
  ) => Promise<JourneySendResult<TContext, TStepId>>;
  updateContext: (updater: (context: TContext) => TContext) => JourneySnapshot<TContext, TStepId>;
  clearStepError: (stepId?: TStepId) => JourneySnapshot<TContext, TStepId>;
  reset: () => JourneySnapshot<TContext, TStepId>;
  subscribe: (listener: () => void) => () => void;
};
