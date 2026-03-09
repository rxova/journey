import type { JourneyTransition } from "./transitions.types";

/** Terminal outcomes reached when a journey completes or is explicitly terminated. */
export type JourneyTerminal = "COMPLETE" | "TERMINATED";

/** Runtime machine status constants. */
export const JOURNEY_STATUS = {
  RUNNING: "running",
  COMPLETE: "complete",
  TERMINATED: "terminated"
} as const;

/** Union of possible runtime machine statuses. */
export type JourneyStatus = (typeof JOURNEY_STATUS)[keyof typeof JOURNEY_STATUS];

/** Wildcard step identifier used by transitions that match from any step. */
export const JOURNEY_WILDCARD = "*" as const;

/** Built-in event constants that are part of core machine behavior. */
export const JOURNEY_EVENT = {
  GO_TO_STEP_BY_ID: "goToStepById"
} as const;

/** Machine event types that are always recognized by core. */
export type JourneyBuiltInEvent = (typeof JOURNEY_EVENT)[keyof typeof JOURNEY_EVENT];
/** Event literal type for the built-in go-to-step command. */
export type JourneyGoToStepByIdEventType = typeof JOURNEY_EVENT.GO_TO_STEP_BY_ID;
/** Wildcard origin marker for transitions. */
export type JourneyBuiltInFrom = typeof JOURNEY_WILDCARD;
/** Default transition event names supported by machine convenience APIs. */
export type JourneyDefaultEventType =
  | "goToNextStep"
  | "goToPreviousStep"
  | "terminateJourney"
  | "completeJourney";

/** Async lifecycle phases tracked per step while guards/effects run. */
export const JOURNEY_ASYNC_PHASE = {
  IDLE: "idle",
  EVALUATING_WHEN: "evaluating-when",
  RUNNING_EFFECT: "running-effect",
  ERROR: "error"
} as const;

/** Union of supported async lifecycle phases. */
export type JourneyAsyncPhase = (typeof JOURNEY_ASYNC_PHASE)[keyof typeof JOURNEY_ASYNC_PHASE];

/** Async execution state for a single step. */
export type JourneyStepAsyncState = {
  phase: JourneyAsyncPhase;
  eventType: string | null;
  transitionId: string | null;
  error: unknown | null;
};

/** Aggregated async state for the machine, keyed by step id. */
export type JourneyAsyncState<TStepId extends string> = {
  isLoading: boolean;
  byStep: Record<TStepId, JourneyStepAsyncState>;
};

/** Minimal event shape used across runtime boundaries. */
export type JourneyBaseEvent = {
  type: string;
  payload?: unknown;
};

/** Optional event payload map by event type. */
export type JourneyEventPayloadMap<TEventType extends string> = Partial<
  Record<TEventType | JourneyBuiltInEvent, unknown>
>;

/** Resolves payload type for a specific event type from the provided payload map. */
export type JourneyPayloadFor<
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>,
  TEvent extends TEventType | JourneyBuiltInEvent
> = TEvent extends keyof TPayloadMap ? TPayloadMap[TEvent] : unknown;

/** Event-type union accepted by machine `.send()`, including built-in convenience events. */
export type JourneyMachineEventType<TEventType extends string> =
  | TEventType
  | JourneyDefaultEventType;

/** Payload map available to machine `.send()`, including built-in convenience events. */
export type JourneyMachinePayloadMap<
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
> = TPayloadMap & JourneyEventPayloadMap<JourneyDefaultEventType>;

type JourneyPayloadForDefaultEvent<
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>,
  TDefaultEvent extends JourneyDefaultEventType
> = JourneyPayloadFor<
  JourneyMachineEventType<TEventType>,
  JourneyMachinePayloadMap<TEventType, TPayloadMap>,
  TDefaultEvent
>;

/** Built-in direct-navigation event that targets a specific step id. */
export type JourneyGoToEvent<TStepId extends string, TPayload = unknown> = {
  type: JourneyGoToStepByIdEventType;
  stepId: TStepId;
  payload?: TPayload;
};

/** Event union available to transitions and guards for the declared event type set. */
export type JourneyEvent<
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
> =
  | JourneyGoToEvent<
      TStepId,
      JourneyPayloadFor<TEventType, TPayloadMap, JourneyGoToStepByIdEventType>
    >
  | {
      [TType in TEventType]: {
        type: TType;
        payload?: JourneyPayloadFor<TEventType, TPayloadMap, TType>;
      };
    }[TEventType];

type JourneyDefaultMachineEvent<
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
> = {
  [TType in JourneyDefaultEventType]: {
    type: TType;
    payload?: JourneyPayloadFor<
      JourneyMachineEventType<TEventType>,
      JourneyMachinePayloadMap<TEventType, TPayloadMap>,
      TType
    >;
  };
}[JourneyDefaultEventType];

type JourneyCustomMachineEvent<
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
> = {
  [TType in TEventType]: {
    type: TType;
    payload?: JourneyPayloadFor<TEventType, TPayloadMap, TType>;
  };
}[TEventType];

/** Event union accepted by `JourneyMachine.send`. */
export type JourneySendEvent<
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
> =
  | JourneyGoToEvent<
      TStepId,
      JourneyPayloadFor<
        JourneyMachineEventType<TEventType>,
        JourneyMachinePayloadMap<TEventType, TPayloadMap>,
        JourneyGoToStepByIdEventType
      >
    >
  | JourneyDefaultMachineEvent<TEventType, TPayloadMap>
  | JourneyCustomMachineEvent<TEventType, TPayloadMap>;

/**
 * Step definition with optional metadata and optional typed extension fields.
 * Use `TStepExtra` to explicitly model additional per-step properties.
 */
export type JourneyStepDefinition<
  TStepMeta = unknown,
  TStepExtra extends object = Record<never, never>
> = {
  meta?: TStepMeta;
} & TStepExtra;

/** Serializable runtime snapshot of the journey state. */
export type JourneySnapshot<TContext, TStepId extends string, TStepMeta = unknown> = {
  currentStepId: TStepId;
  history: {
    timeline: readonly TStepId[];
    index: number;
  };
  context: TContext;
  visited: Record<TStepId, boolean>;
  stepMeta: Record<TStepId, TStepMeta>;
  status: JourneyStatus;
  async: JourneyAsyncState<TStepId>;
};

/** Selector function that derives a value from a machine snapshot. */
export type JourneySelector<
  TContext,
  TStepId extends string,
  TStepMeta = unknown,
  TSelected = unknown
> = (snapshot: JourneySnapshot<TContext, TStepId, TStepMeta>) => TSelected;

/** Equality function used to compare selected values between snapshot updates. */
export type JourneyEqualityFn<TValue> = (previous: TValue, next: TValue) => boolean;

/** Full machine definition used to create a journey machine instance. */
export type JourneyDefinition<
  TContext,
  TStepId extends string = string,
  TEventType extends string = JourneyDefaultEventType,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>,
  TStepMeta = unknown,
  TStepExtra extends object = Record<never, never>
> = {
  initial: TStepId;
  context: TContext;
  steps: Record<TStepId, JourneyStepDefinition<TStepMeta, TStepExtra>>;
  transitions: readonly JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>[];
};

/** Optional machine features */
export type JourneyMachineOptions = {
  completeOnNoNextStep?: boolean;
};

/** Result returned from send/navigation APIs. */
export type JourneySendResult<TContext, TStepId extends string, TStepMeta = unknown> = {
  transitioned: boolean;
  transitionId?: string;
  error?: unknown;
  snapshot: JourneySnapshot<TContext, TStepId, TStepMeta>;
};

/** Observation events emitted by the machine lifecycle/event stream. */
export type JourneyObservationEvent<
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>,
  TStepMeta = unknown
> =
  | {
      type: "journey.start";
      stepId: TStepId;
      timestamp: number;
    }
  | {
      type: "transition.start";
      from: TStepId;
      event: JourneySendEvent<TStepId, TEventType, TPayloadMap>;
      timestamp: number;
    }
  | {
      type: "transition.success";
      from: TStepId;
      to: TStepId | JourneyTerminal;
      eventType: string;
      transitionId: string | null;
      timestamp: number;
    }
  | {
      type: "transition.error";
      from: TStepId;
      eventType: string;
      transitionId: string | null;
      error: unknown;
      timestamp: number;
    }
  | {
      type: "step.exit";
      stepId: TStepId;
      timestamp: number;
    }
  | {
      type: "step.enter";
      stepId: TStepId;
      timestamp: number;
    }
  | {
      type: "journey.complete";
      stepId: TStepId;
      timestamp: number;
    }
  | {
      type: "journey.close";
      stepId: TStepId;
      timestamp: number;
    }
  | {
      type: "navigation.previous";
      from: TStepId;
      to: TStepId;
      requestedSteps: number;
      appliedSteps: number;
      timestamp: number;
    }
  | {
      type: "navigation.lastVisited";
      from: TStepId;
      to: TStepId;
      timestamp: number;
    }
  | {
      type: "metadata.updated";
      stepId: TStepId;
      previous: TStepMeta;
      next: TStepMeta;
      timestamp: number;
    };

/** Runtime machine API for reading snapshots, sending events, and controlling flow. */
export type JourneyMachine<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>,
  TStepMeta = unknown
> = {
  getSnapshot: () => JourneySnapshot<TContext, TStepId, TStepMeta>;
  send: (
    event: JourneySendEvent<TStepId, TEventType, TPayloadMap>
  ) => Promise<JourneySendResult<TContext, TStepId, TStepMeta>>;
  goToNextStep: () => Promise<JourneySendResult<TContext, TStepId, TStepMeta>>;
  terminateJourney: (
    payload?: JourneyPayloadForDefaultEvent<TEventType, TPayloadMap, "terminateJourney">
  ) => Promise<JourneySendResult<TContext, TStepId, TStepMeta>>;
  completeJourney: (
    payload?: JourneyPayloadForDefaultEvent<TEventType, TPayloadMap, "completeJourney">
  ) => Promise<JourneySendResult<TContext, TStepId, TStepMeta>>;
  goToPreviousStep: (steps?: number) => Promise<JourneySendResult<TContext, TStepId, TStepMeta>>;
  goToLastVisitedStep: () => Promise<JourneySendResult<TContext, TStepId, TStepMeta>>;
  updateContext: (
    updater: (context: TContext) => TContext
  ) => JourneySnapshot<TContext, TStepId, TStepMeta>;
  updateStepMetadata: (
    stepId: TStepId,
    updater: (metadata: TStepMeta) => TStepMeta
  ) => JourneySnapshot<TContext, TStepId, TStepMeta>;
  clearStepError: (stepId?: TStepId) => JourneySnapshot<TContext, TStepId, TStepMeta>;
  resetMachine: () => JourneySnapshot<TContext, TStepId, TStepMeta>;
  dispose: () => void;
  subscribe: (listener: () => void) => () => void;
  subscribeSelector: <TSelected>(
    selector: JourneySelector<TContext, TStepId, TStepMeta, TSelected>,
    listener: (next: TSelected, previous: TSelected) => void,
    equalityFn?: JourneyEqualityFn<TSelected>
  ) => () => void;
  subscribeEvent: (
    listener: (event: JourneyObservationEvent<TStepId, TEventType, TPayloadMap, TStepMeta>) => void
  ) => () => void;
  subscribeStart: (
    listener: (
      event: Extract<
        JourneyObservationEvent<TStepId, TEventType, TPayloadMap, TStepMeta>,
        { type: "journey.start" }
      >
    ) => void
  ) => () => void;
  subscribeComplete: (
    listener: (
      event: Extract<
        JourneyObservationEvent<TStepId, TEventType, TPayloadMap, TStepMeta>,
        { type: "journey.complete" }
      >
    ) => void
  ) => () => void;
  subscribeTerminate: (
    listener: (
      event: Extract<
        JourneyObservationEvent<TStepId, TEventType, TPayloadMap, TStepMeta>,
        { type: "journey.close" }
      >
    ) => void
  ) => () => void;
};
