import type {
  JourneyResolvedTransition,
  JourneyStepLifecycleCallback,
  JourneyTransitionsDefinition
} from "./transitions.types";

/** Terminal outcomes reached when a journey completes or is explicitly terminated. */
export type JourneyTerminal = "COMPLETE" | "TERMINATED";

/** Union of possible runtime machine statuses. */
export type JourneyStatus = "idled" | "running" | "completed" | "terminated";

/** Mode inferred from the journey transition syntax. */
export type JourneyMode = "linear" | "graph" | "headless";

/** Wildcard step identifier, exposed as a type-only literal. */
export type JourneyBuiltInFrom = "*";

/** Default transition event names supported by machine convenience APIs. */
export type JourneyDefaultEventType =
  | "goToNextStep"
  | "goToPreviousStep"
  | "terminateJourney"
  | "completeJourney"
  | "goToStepById";

/** JSON primitive values accepted inside runtime context. */
export type JourneyJsonPrimitive = string | number | boolean | null;

/** JSON-compatible value accepted inside runtime context. */
export type JourneyJsonValue =
  | JourneyJsonPrimitive
  | { [key: string]: JourneyJsonValue }
  | JourneyJsonValue[];

/** JSON-compatible object accepted as the machine context root. */
export type JourneyJsonObject = { [key: string]: JourneyJsonValue };

/** Derives the full event type union from a user-supplied event map. */
export type JourneyFullEventType<TEventMap extends Record<string, unknown>> =
  | (keyof TEventMap & string)
  | JourneyDefaultEventType;

type JourneyBuiltInSendEventType = Exclude<JourneyDefaultEventType, "goToStepById">;
type JourneyCustomSendEventType<TEventMap extends Record<string, unknown>> = Exclude<
  keyof TEventMap & string,
  JourneyDefaultEventType
>;

/** Union of supported async lifecycle phases. */
export type JourneyAsyncPhase = "idle" | "evaluating-when" | "error";

/** Async execution state for a single step. */
export type JourneyStepAsyncState = {
  phase: JourneyAsyncPhase;
  eventType: string | null;
  transitionId: string | null;
  /** Captured error from a failed guard or lifecycle handler. `null` when no error is present. */
  error: unknown;
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

/** Resolves payload type for a specific event type from the provided event map. */
export type JourneyPayloadFor<
  TEventMap extends Record<string, unknown>,
  TEvent extends string
> = TEvent extends keyof TEventMap ? TEventMap[TEvent] : unknown;

/** Built-in direct-navigation event that targets a specific step id. */
export type JourneyGoToEvent<TStepId extends string, TPayload = unknown> = {
  type: "goToStepById";
  stepId: TStepId;
  payload?: TPayload;
};

/** Built-in send events supported by machine convenience APIs. */
export type JourneyBuiltInSendEvent<
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>
> =
  | JourneyGoToEvent<TStepId, JourneyPayloadFor<TEventMap, "goToStepById">>
  | {
      [TType in JourneyBuiltInSendEventType]: {
        type: TType;
        payload?: JourneyPayloadFor<TEventMap, TType>;
      };
    }[JourneyBuiltInSendEventType];

/** Custom send events derived from a user-supplied event map. */
export type JourneyCustomSendEvent<
  TEventMap extends Record<string, unknown> = Record<never, never>
> = {
  [TType in JourneyCustomSendEventType<TEventMap>]: {
    type: TType;
    payload?: JourneyPayloadFor<TEventMap, TType>;
  };
}[JourneyCustomSendEventType<TEventMap>];

/** Event union accepted by `JourneyMachine.send`. */
export type JourneySendEvent<
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>
> = JourneyBuiltInSendEvent<TStepId, TEventMap> | JourneyCustomSendEvent<TEventMap>;

/** Event union available to transitions and guards for the declared event type set. */
export type JourneyEvent<
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>
> = JourneySendEvent<TStepId, TEventMap>;

/** Step definition with optional metadata and lifecycle callbacks. */
export type JourneyStepDefinition<
  TContext extends JourneyJsonObject = JourneyJsonObject,
  TStepId extends string = string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>
> = {
  meta?: TStepMeta;
  /** Called when the machine enters this step. */
  onEnter?: JourneyStepLifecycleCallback<TContext, TStepId, TEventMap, THandlers>;
  /** Called when the machine leaves this step. */
  onLeave?: JourneyStepLifecycleCallback<TContext, TStepId, TEventMap, THandlers>;
};

/** Timeline of visited steps and current history index. */
export type JourneyHistory<TStepId extends string> = {
  timeline: readonly TStepId[];
  index: number;
};

/** Core snapshot state without async execution details. */
export type JourneySnapshotStateBase<TContext extends JourneyJsonObject, TStepId extends string> = {
  currentStepId: TStepId;
  history: JourneyHistory<TStepId>;
  context: TContext;
  visited: Record<TStepId, boolean>;
  status: JourneyStatus;
};

/** Serializable runtime snapshot of the journey state. */
export type JourneySnapshot<
  TContext extends JourneyJsonObject,
  TStepId extends string
> = JourneySnapshotStateBase<TContext, TStepId> & {
  async: JourneyAsyncState<TStepId>;
};

/** Common read-only computed state exposed by a machine instance. */
export type JourneyComputedBase<TStepId extends string> = {
  mode: JourneyMode;
  activeStepId: TStepId;
  activeStepIndex: number;
  visitedStepCount: number;
  isLoading: boolean;
  isIdle: boolean;
  isRunning: boolean;
  isComplete: boolean;
  isTerminated: boolean;
  isInitialStep: boolean;
};

/** Wizard-style computed state available when transitions use linear array syntax. */
export type JourneyLinearComputed<TStepId extends string> = JourneyComputedBase<TStepId> & {
  mode: "linear";
  stepCount: number;
  journeyLength: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  stepOrder: readonly TStepId[];
};

/** Computed state available when transitions use graph object syntax. */
export type JourneyGraphComputed<TStepId extends string> = JourneyComputedBase<TStepId> & {
  mode: "graph";
  stepCount?: undefined;
  journeyLength?: undefined;
  isFirstStep?: undefined;
  isLastStep?: undefined;
  stepOrder?: undefined;
};

/** Computed state available when transitions are omitted and navigation is headless. */
export type JourneyHeadlessComputed<TStepId extends string> = JourneyComputedBase<TStepId> & {
  mode: "headless";
  stepCount?: undefined;
  journeyLength?: undefined;
  isFirstStep?: undefined;
  isLastStep?: undefined;
  stepOrder?: undefined;
};

/** Mode-aware computed state returned by `JourneyMachine.getComputed()`. */
export type JourneyComputed<TStepId extends string> =
  | JourneyLinearComputed<TStepId>
  | JourneyGraphComputed<TStepId>
  | JourneyHeadlessComputed<TStepId>;

/** Selector function that derives a value from a machine snapshot. */
export type JourneySelector<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TSelected = unknown
> = (snapshot: JourneySnapshot<TContext, TStepId>) => TSelected;

/** Equality function used to compare selected values between snapshot updates. */
export type JourneyEqualityFn<TValue> = (previous: TValue, next: TValue) => boolean;

/** Shared definition fields without transition configuration. */
export type JourneyDefinitionBase<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>
> = {
  /**
   * The step the machine starts on.
   * - **Linear transitions**: optional — defaults to the first element of the
   *   transitions array. When provided, must exist in the array and the machine
   *   starts from that step (useful for resuming mid-flow).
   * - **Graph / headless**: required.
   */
  initial?: TStepId;
  context: TContext;
  handlers?: THandlers;
  steps: Record<
    TStepId,
    JourneyStepDefinition<TContext, TStepId, Record<never, never>, TStepMeta, THandlers>
  >;
};

/** Full machine definition used to create a journey machine instance. */
export type JourneyDefinition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>
> = Omit<JourneyDefinitionBase<TContext, TStepId, TStepMeta, THandlers>, "steps"> & {
  steps: Record<TStepId, JourneyStepDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>>;
  transitions?: JourneyTransitionsDefinition<TContext, TStepId, TEventMap, THandlers>;
};

export type JourneyResolvedDefinition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>
> = Required<Pick<JourneyDefinitionBase<TContext, TStepId, TStepMeta, THandlers>, "initial">> &
  Omit<JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>, "transitions"> & {
    transitions: readonly JourneyResolvedTransition<TContext, TStepId, TEventMap, THandlers>[];
  };

export type JourneyExecutionPathEventType<TEventType extends string> =
  | TEventType
  | JourneyDefaultEventType;

/** Structural execution path returned by `getExecutionPaths()`. */
export type JourneyExecutionPath<TStepId extends string, TEventType extends string> = {
  steps: TStepId[];
  events: JourneyExecutionPathEventType<TEventType>[];
  terminated: "final" | "depth" | "cycle" | "limit";
};

/** Result returned by structural path enumeration. */
export type JourneyExecutionPathsResult<TStepId extends string, TEventType extends string> = {
  paths: JourneyExecutionPath<TStepId, TEventType>[];
  truncated: boolean;
  cyclesDetected: boolean;
};

/** Options for structural path enumeration from the initial step. */
export type JourneyExecutionPathOptions = {
  maxDepth?: number;
  maxPaths?: number;
};

/** Result returned from send/navigation APIs. */
export type JourneySendResult<TContext extends JourneyJsonObject, TStepId extends string> = {
  transitioned: boolean;
  transitionId?: string;
  label?: string;
  error?: unknown;
  snapshot: JourneySnapshot<TContext, TStepId>;
};
