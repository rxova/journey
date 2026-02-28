import type { JourneyPersistenceOptions } from "./persistence.types";
import type { JourneyTransition } from "./transitions.types";

export type JourneyTerminal = "COMPLETE" | "TERMINATED";

export const JOURNEY_STATUS = {
  RUNNING: "running",
  COMPLETE: "complete",
  TERMINATED: "terminated"
} as const;

export type JourneyStatus = (typeof JOURNEY_STATUS)[keyof typeof JOURNEY_STATUS];

export const JOURNEY_WILDCARD = "*" as const;

export const JOURNEY_EVENT = {
  GO_TO_STEP_BY_ID: "goToStepById"
} as const;

export type JourneyBuiltInEvent = (typeof JOURNEY_EVENT)[keyof typeof JOURNEY_EVENT];
export type JourneyBuiltInFrom = typeof JOURNEY_WILDCARD;
export type JourneyDefaultEventType =
  | "goToNextStep"
  | "goToPreviousStep"
  | "terminateJourney"
  | "completeJourney";

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

type JourneyPayloadForDefaultEvent<
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>,
  TDefaultEvent extends JourneyDefaultEventType
> = JourneyPayloadFor<
  TEventType | TDefaultEvent,
  TPayloadMap & JourneyEventPayloadMap<TDefaultEvent>,
  TDefaultEvent
>;

export type JourneyGoToEvent<TStepId extends string, TPayload = unknown> = {
  type: (typeof JOURNEY_EVENT)["GO_TO_STEP_BY_ID"];
  stepId: TStepId;
  payload?: TPayload;
};

export type JourneyEvent<
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>
> =
  | JourneyGoToEvent<
      TStepId,
      JourneyPayloadFor<TEventType, TPayloadMap, (typeof JOURNEY_EVENT)["GO_TO_STEP_BY_ID"]>
    >
  | {
      [TType in TEventType]: {
        type: TType;
        payload?: JourneyPayloadFor<TEventType, TPayloadMap, TType>;
      };
    }[TEventType];

export type JourneyStepDefinition<TStepMeta = unknown> = {
  meta?: TStepMeta;
} & Record<string, unknown>;

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

export type JourneyDefinition<
  TContext,
  TStepId extends string = string,
  TEventType extends string = JourneyDefaultEventType,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>,
  TStepMeta = unknown
> = {
  initial: TStepId;
  context: TContext;
  steps: Record<TStepId, JourneyStepDefinition<TStepMeta>>;
  transitions: readonly JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>[];
};

export type JourneyMachineOptions<TContext, TStepId extends string, TStepMeta = unknown> = {
  persistence?: JourneyPersistenceOptions<TContext, TStepId, TStepMeta>;
};

export type JourneySendResult<TContext, TStepId extends string, TStepMeta = unknown> = {
  transitioned: boolean;
  transitionId?: string;
  snapshot: JourneySnapshot<TContext, TStepId, TStepMeta>;
};

export type JourneyObservationEvent<
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>,
  TStepMeta = unknown
> =
  | {
      type: "transition.start";
      from: TStepId;
      event: JourneyEvent<TStepId, TEventType, TPayloadMap>;
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

export type JourneyMachine<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType> = Record<never, never>,
  TStepMeta = unknown
> = {
  getSnapshot: () => JourneySnapshot<TContext, TStepId, TStepMeta>;
  send: (
    event: JourneyEvent<TStepId, TEventType, TPayloadMap>
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
  subscribe: (listener: () => void) => () => void;
  subscribeEvent: (
    listener: (event: JourneyObservationEvent<TStepId, TEventType, TPayloadMap, TStepMeta>) => void
  ) => () => void;
};
