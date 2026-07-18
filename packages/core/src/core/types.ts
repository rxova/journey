/**
 * Shared core contracts for `@rxova/journey-core`.
 *
 * The machine object holds only stable methods; every piece of changing state
 * lives in an immutable {@link JourneySnapshot} rebuilt at defined emission
 * points (navigation accepted → commit → settle, plus lifecycle and context
 * changes) and delivered to subscribers.
 */
import type { JourneyStorage } from "../plugins/persistence/persistence.types";

/** Journey lifecycle status (meta-state-machine, enforced in core). */
export type JourneyStatus = "idle" | "running" | "paused" | "completed" | "terminated";

/** An event declaration: discriminated union member `{ type; payload? }`. */
export type JourneyEventObject = { readonly type: string; readonly payload?: unknown };

/** Extracts the payload type of event `TType` from a declared event union. */
export type JourneyEventPayload<TEvents extends JourneyEventObject, TType extends TEvents["type"]> =
  Extract<TEvents, { type: TType }> extends { payload: infer P } ? P : undefined;

/**
 * Why a navigation was rejected.
 *
 * - `error` — navigation work threw, rejected, timed out, or failed to commit.
 * - `transitioning` — another navigation's hook chain is still pending.
 * - `not-running` — the machine is idle, paused, completed, or terminated.
 * - `invalid-target` — unknown step id, or (graph) no transition targets it.
 * - `no-enabled-transition` — the event matched no enabled candidate.
 * - `out-of-bounds` — timeline move past its edge (back at index 0, forward at tip).
 * - `no-op` — navigation to the current position.
 * - `disposed` — the machine was disposed; all methods are safe no-ops.
 */
export type NavigationFailureReason =
  | "error"
  | "transitioning"
  | "not-running"
  | "invalid-target"
  | "no-enabled-transition"
  | "out-of-bounds"
  | "no-op"
  | "disposed";

/** Result of every navigation verb (and of graph `send`). */
export type NavigationResult<TStepId extends string = string> =
  | { readonly ok: true; readonly from: TStepId | null; readonly to: TStepId }
  | { readonly ok: false; readonly reason: NavigationFailureReason; readonly error?: unknown };

/** Journey outcome recorded by `complete(payload?)` / `terminate(payload?)`. */
export type JourneyOutcome<TCompletePayload = unknown, TTerminatePayload = unknown> =
  | { readonly type: "completed"; readonly payload: TCompletePayload | undefined }
  | { readonly type: "terminated"; readonly payload: TTerminatePayload | undefined };

/** Machine-level async transition state (a snapshot source of truth). */
export type TransitionState<TStepId extends string = string> = {
  readonly pending: boolean;
  readonly phase: "working" | "leaving" | "entering" | null;
  readonly from: TStepId | null;
  readonly to: TStepId | null;
};

/** Async state of the current navigation work or lifecycle effect chain. */
export type StepAsyncState = {
  readonly isLoading: boolean;
  readonly isSuccess: boolean;
  readonly isError: boolean;
  readonly error: unknown | null;
};

/** Fields present on `currentStep` for every journey kind. */
export type CurrentStepBase<TStepId extends string, TMeta> = {
  readonly id: TStepId;
  readonly metadata: TMeta;
  /** True while this is the first ever entry of the step in this run. */
  readonly isFirstTimeVisit: boolean;
  readonly async: StepAsyncState;
};

/** Browser-like timeline state shared by every journey kind. */
export type JourneyHistoryState<TStepId extends string> = {
  readonly timeline: readonly TStepId[];
  /** Pointer into `timeline`; -1 while idle. */
  readonly currentIndex: number;
  readonly visited: Readonly<Record<TStepId, boolean>>;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
};

/** Derived lifecycle booleans (`isLoading === transition.pending`), plus the recorded outcome. */
export type MachineState<TCompletePayload = unknown, TTerminatePayload = unknown> = {
  readonly isLoading: boolean;
  readonly isIdle: boolean;
  readonly isRunning: boolean;
  readonly isPaused: boolean;
  readonly isCompleted: boolean;
  readonly isTerminated: boolean;
  readonly outcome: JourneyOutcome<TCompletePayload, TTerminatePayload> | null;
};

/** Fields shared by every snapshot kind (discriminated on `type`). */
export type JourneySnapshotBase<
  TContext,
  TStepId extends string,
  TMeta,
  TCompletePayload = unknown,
  TTerminatePayload = unknown
> = {
  readonly status: JourneyStatus;
  readonly context: TContext;
  readonly transition: TransitionState<TStepId>;
  readonly history: JourneyHistoryState<TStepId>;
  readonly machine: MachineState<TCompletePayload, TTerminatePayload>;
  readonly plugins: Readonly<Record<string, unknown>>;
  readonly currentStep: CurrentStepBase<TStepId, TMeta> | null;
};

/** Linear snapshots carry declared-order derivations; graph fields don't exist. */
export type LinearSnapshot<
  TContext,
  TStepId extends string,
  TMeta,
  TCompletePayload = unknown,
  TTerminatePayload = unknown
> = Omit<
  JourneySnapshotBase<TContext, TStepId, TMeta, TCompletePayload, TTerminatePayload>,
  "currentStep"
> & {
  readonly type: "linear";
  readonly currentStep:
    | (CurrentStepBase<TStepId, TMeta> & {
        /** Index in declared order. */
        readonly index: number;
        readonly isFirstStep: boolean;
        readonly isLastStep: boolean;
      })
    | null;
  readonly steps: {
    readonly totalSteps: number;
    readonly stepOrder: readonly TStepId[];
    readonly visitedStepCount: number;
  };
};

/** Guard evaluation recorded for an outgoing graph transition candidate. */
export type GraphGuardState = "none" | "passed" | "failed";

/** Serializable routing state for one candidate declared from the current graph step. */
export type GraphTransitionSnapshot<TStepId extends string, TEventType extends string> = {
  /** Event that evaluates this candidate. */
  readonly event: TEventType;
  /** Candidate destination. */
  readonly to: TStepId;
  /** Zero-based declaration order among candidates for the same event. */
  readonly priority: number;
  /** Current result of the candidate's guard, or `none` when no guard is declared. */
  readonly guard: GraphGuardState;
  /** Whether the candidate's guard currently permits routing. */
  readonly enabled: boolean;
  /** Whether sending this event would select this candidate under first-enabled semantics. */
  readonly selected: boolean;
};

/** Graph snapshots carry declared and enabled transition derivations; order fields don't exist. */
export type GraphSnapshot<
  TContext,
  TStepId extends string,
  TMeta,
  TEvents extends JourneyEventObject = JourneyEventObject,
  TCompletePayload = unknown,
  TTerminatePayload = unknown
> = Omit<
  JourneySnapshotBase<TContext, TStepId, TMeta, TCompletePayload, TTerminatePayload>,
  "currentStep"
> & {
  readonly type: "graph";
  readonly currentStep:
    | (CurrentStepBase<TStepId, TMeta> & {
        /** No outgoing transitions are defined from this step. */
        readonly isTerminal: boolean;
      })
    | null;
  readonly steps: {
    readonly totalSteps: number;
    readonly visitedStepCount: number;
  };
  /** Event names declared by outgoing candidates from the current step. */
  readonly declaredEvents: readonly TEvents["type"][];
  /** Events with at least one enabled candidate from the current step. */
  readonly availableEvents: readonly TEvents["type"][];
  /** Targets of enabled candidates from the current step. */
  readonly availableSteps: readonly TStepId[];
  /** Guard and selection state for every outgoing candidate from the current step. */
  readonly outgoingTransitions: readonly GraphTransitionSnapshot<TStepId, TEvents["type"]>[];
};

export type JourneySnapshot<
  TContext = unknown,
  TStepId extends string = string,
  TMeta = unknown,
  TEvents extends JourneyEventObject = JourneyEventObject,
  TCompletePayload = unknown,
  TTerminatePayload = unknown
> =
  | LinearSnapshot<TContext, TStepId, TMeta, TCompletePayload, TTerminatePayload>
  | GraphSnapshot<TContext, TStepId, TMeta, TEvents, TCompletePayload, TTerminatePayload>;

/** Context updater used by `machine.context.update` and hook args. */
export type ContextUpdater<TContext> = (previous: TContext) => TContext;

/**
 * Arguments passed to step hooks.
 *
 * `event` is the graph event that caused the transition; `null` for timeline
 * moves, linear navigation, and the initial entry on `start()`.
 * Hooks run after navigation commits. Context updates made inside hooks apply
 * immediately and are side effects; hook failures never roll navigation back.
 */
export type StepHookArgs<
  TContext,
  TStepId extends string,
  TEvents extends JourneyEventObject = never,
  TSnap = JourneySnapshot<TContext, TStepId>
> = {
  readonly snapshot: TSnap;
  readonly from: TStepId | null;
  readonly to: TStepId;
  readonly event: TEvents | null;
  readonly updateContext: (updater: ContextUpdater<TContext>) => void;
  /**
   * Queues an event for processing after the current transition fully settles
   * (FIFO). Only meaningful on graph journeys; linear hooks receive a no-op.
   */
  readonly raise: (event: TEvents) => void;
};

/** `onLeave` is an awaited post-commit side effect and cannot block navigation. */
export type OnLeaveHook<
  TContext,
  TStepId extends string,
  TEvents extends JourneyEventObject = never,
  TSnap = JourneySnapshot<TContext, TStepId>
> = (args: StepHookArgs<TContext, TStepId, TEvents, TSnap>) => void | Promise<void>;

/** `onEnter` is an awaited post-commit side effect and cannot block navigation. */
export type OnEnterHook<
  TContext,
  TStepId extends string,
  TEvents extends JourneyEventObject = never,
  TSnap = JourneySnapshot<TContext, TStepId>
> = (args: StepHookArgs<TContext, TStepId, TEvents, TSnap>) => void | Promise<void>;

/** Subscription event names. */
export type JourneySubscriptionEvent =
  | "stepEnter"
  | "stepLeave"
  | "statusChange"
  | "contextChange"
  | "navigationBlocked"
  | "error";

export type JourneyEventPayloads<
  TContext,
  TStepId extends string,
  TSnap = JourneySnapshot<TContext, TStepId>
> = {
  stepEnter: {
    readonly snapshot: TSnap;
    readonly from: TStepId | null;
    readonly to: TStepId;
    readonly direction: StepEnterDirection;
  };
  stepLeave: {
    readonly snapshot: TSnap;
    readonly from: TStepId;
    readonly to: TStepId;
  };
  statusChange: {
    readonly snapshot: TSnap;
    readonly previous: JourneyStatus;
    readonly current: JourneyStatus;
  };
  contextChange: {
    readonly snapshot: TSnap;
    readonly previous: TContext;
    readonly current: TContext;
  };
  navigationBlocked: {
    readonly snapshot: TSnap;
    readonly reason: NavigationFailureReason;
    readonly from: TStepId | null;
    readonly to: TStepId | null;
    readonly error?: unknown;
  };
  error: {
    readonly snapshot: TSnap;
    readonly error: unknown;
    /** Which pipeline stage threw. */
    readonly phase: "work" | "leave" | "enter" | "transition" | "raise";
    readonly stepId: TStepId | null;
  };
};

export type Unsubscribe = () => void;

export type JourneySubscriptions<
  TContext,
  TStepId extends string,
  TSnap = JourneySnapshot<TContext, TStepId>
> = {
  subscribeSelector<TSelected>(
    selector: (snapshot: TSnap) => TSelected,
    listener: (selected: TSelected) => void,
    equals?: (a: TSelected, b: TSelected) => boolean
  ): Unsubscribe;
  subscribeEvent<TEvent extends JourneySubscriptionEvent>(
    event: TEvent,
    listener: (payload: JourneyEventPayloads<TContext, TStepId, TSnap>[TEvent]) => void
  ): Unsubscribe;
};

/**
 * Lifecycle verbs. Each returns `true` when the lifecycle change applied and
 * `false` when rejected (wrong source status, pending transition, disposed).
 */
export type JourneyControls<TCompletePayload = unknown, TTerminatePayload = unknown> = {
  /** idle → running; enters the first/initial step. */
  start(): boolean;
  /** running → paused; navigation is rejected while paused. */
  pause(): boolean;
  /** paused → running. */
  resume(): boolean;
  /** running → completed. Explicit only — never fired by navigation. */
  complete(payload?: TCompletePayload): boolean;
  /** any → terminated. Wins over a pending transition. */
  terminate(payload?: TTerminatePayload): boolean;
  /** completed | terminated → running; resets timeline + context to initial. */
  restart(): boolean;
};

export type NavigationDirection = "forward" | "backward";

/**
 * How a step was entered, by intent rather than index math: only
 * `goToNextStep`/`goToPreviousStep` report `"forward"`/`"backward"`; the
 * initial entry, absolute verbs (`goToStepById`, `goToStepByIndex`,
 * `goToLastVisitedStep`), and graph `send` report `"jump"`.
 */
export type StepEnterDirection = NavigationDirection | "jump";

/** Read-only arguments for work that must succeed before navigation commits. */
export type NavigationWorkArgs<TStepId extends string, TSnap> = {
  readonly snapshot: TSnap;
  readonly from: TStepId;
  readonly to: TStepId;
  readonly direction: NavigationDirection;
};

/**
 * Transactional work attached to next/previous navigation.
 *
 * `run` is awaited before movement. If it throws, rejects, or times out, the
 * machine stays on the current step. `commit` runs synchronously after `run`
 * succeeds; its context updates are staged and published atomically with the
 * position change.
 */
export type NavigationWork<TContext, TStepId extends string, TSnap, TResult = void> = {
  readonly run: (args: NavigationWorkArgs<TStepId, TSnap>) => TResult | Promise<TResult>;
  readonly commit?: (
    args: NavigationWorkArgs<TStepId, TSnap> & {
      readonly result: TResult;
      readonly updateContext: (updater: ContextUpdater<TContext>) => void;
    }
  ) => void;
};

export type JourneyNavigation<TContext, TStepId extends string, TSnap> = {
  goToStepById(id: TStepId): Promise<NavigationResult<TStepId>>;
  /** Timeline pointer back `n`; clamps to start; fails only at index 0. */
  goToPreviousStep: {
    (n?: number): Promise<NavigationResult<TStepId>>;
    <TResult = void>(
      work?: NavigationWork<TContext, TStepId, TSnap, TResult>
    ): Promise<NavigationResult<TStepId>>;
    <TResult = void>(
      n: number,
      work?: NavigationWork<TContext, TStepId, TSnap, TResult>
    ): Promise<NavigationResult<TStepId>>;
  };
  /** Timeline forward; linear falls back to next-in-declared-order at tip. */
  goToNextStep<TResult = void>(
    work?: NavigationWork<TContext, TStepId, TSnap, TResult>
  ): Promise<NavigationResult<TStepId>>;
  /** Pointer → timeline tip; fails if already there. */
  goToLastVisitedStep(): Promise<NavigationResult<TStepId>>;
  /**
   * Registers forward-navigation work for `stepId`, used by `goToNextStep`
   * when no explicit work is passed. Last registration wins; the returned
   * unsubscribe removes only its own registration. Unknown step ids throw.
   */
  registerNextStepInterceptor<TResult = void>(
    stepId: TStepId,
    work: NavigationWork<TContext, TStepId, TSnap, TResult>
  ): Unsubscribe;
};

/** Machine surface shared by linear and graph journeys. */
export type JourneyMachineBase<
  TContext,
  TStepId extends string,
  TSnap = JourneySnapshot<TContext, TStepId>,
  TCompletePayload = unknown,
  TTerminatePayload = unknown
> = {
  getSnapshot(): TSnap;
  controls: JourneyControls<TCompletePayload, TTerminatePayload>;
  navigate: JourneyNavigation<TContext, TStepId, TSnap>;
  subscriptions: JourneySubscriptions<TContext, TStepId, TSnap>;
  context: { update(updater: ContextUpdater<TContext>): void };
  async: { clearError(): void };
  /** Irreversible teardown: drops listeners; all methods become safe no-ops. */
  dispose(): void;
};

/** A read-only structural view of the running definition, for analysis plugins. */
export type JourneyStructure = {
  readonly kind: "linear" | "graph";
  readonly stepIds: readonly string[];
  readonly initial: string;
  /** Flattened transitions in declaration order (empty for linear). */
  readonly transitions: readonly {
    readonly event: string;
    readonly from: string;
    readonly to: string;
    readonly guarded: boolean;
  }[];
};

/** Observe-only taps + reads — no interception in v1. */
export type PluginHost<TContext = unknown, TStepId extends string = string> = {
  getSnapshot(): JourneySnapshot<TContext, TStepId>;
  readonly structure: JourneyStructure;
  /** Fires after commit + settle of every successful navigation (incl. initial entry). */
  onTransition(
    callback: (info: {
      readonly from: TStepId | null;
      readonly to: TStepId;
      readonly snapshot: JourneySnapshot<TContext, TStepId>;
    }) => void
  ): Unsubscribe;
  onStepEnter(
    callback: (info: JourneyEventPayloads<TContext, TStepId>["stepEnter"]) => void
  ): Unsubscribe;
  onStepLeave(
    callback: (info: JourneyEventPayloads<TContext, TStepId>["stepLeave"]) => void
  ): Unsubscribe;
  onNavigationBlocked(
    callback: (info: JourneyEventPayloads<TContext, TStepId>["navigationBlocked"]) => void
  ): Unsubscribe;
  onStatusChange(
    callback: (info: JourneyEventPayloads<TContext, TStepId>["statusChange"]) => void
  ): Unsubscribe;
  onContextChange(
    callback: (info: JourneyEventPayloads<TContext, TStepId>["contextChange"]) => void
  ): Unsubscribe;
  onError(callback: (info: JourneyEventPayloads<TContext, TStepId>["error"]) => void): Unsubscribe;
  onDispose(callback: () => void): void;
};

/**
 * A journey plugin: observes via {@link PluginHost} taps and extends the
 * machine (`machine.plugins[name]`) and snapshot (`snapshot.plugins[name]`).
 * Extensions are always namespaced, never merged into core fields.
 */
export type JourneyPlugin<TName extends string = string, TApi = unknown, TSnapExt = unknown> = {
  readonly name: TName;
  setup(host: PluginHost): {
    api?: TApi;
    deriveSnapshot?: (
      snapshot: JourneySnapshot,
      previousExtension: TSnapExt | undefined
    ) => TSnapExt;
  };
};

/**
 * Variance-friendly plugin bound: `deriveSnapshot`'s `previousExtension`
 * parameter is contravariant, so concrete `JourneyPlugin<N, Api, Ext>` types
 * are not assignable to bare `JourneyPlugin`. Constraints use this instead.
 */
export type AnyJourneyPlugin = {
  readonly name: string;
  setup(host: PluginHost): {
    api?: unknown;
    deriveSnapshot?: (snapshot: JourneySnapshot, previousExtension: never) => unknown;
  };
};

/** Maps a plugin tuple to the `machine.plugins` record. */
export type PluginApis<TPlugins extends readonly AnyJourneyPlugin[]> = {
  readonly [P in TPlugins[number] as P["name"]]: P extends JourneyPlugin<
    string,
    infer TApi,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    infer TSnapExt
  >
    ? TApi
    : never;
};

/** Sugar over the persistence plugin, expanded at creation. */
export type JourneyPersistOption = {
  readonly key: string;
  /** Defaults to `globalThis.localStorage`; creation throws when neither is available. */
  readonly storage?: JourneyStorage;
};

/** Runtime options shared by linear and graph journeys. */
export type JourneyRuntimeOptions<
  TPlugins extends readonly AnyJourneyPlugin[] = readonly [],
  TStepId extends string = string
> = {
  /**
   * Defaults to `false`: subscribe-before-start is the natural order, so the
   * first `stepEnter` never fires before subscribers can attach.
   */
  autoStart?: boolean;
  /**
   * Start (and restart) directly at this step instead of the first/initial
   * one: only the target's `onEnter` fires, earlier steps are neither entered
   * nor visited, and the timeline begins as `[startAt]`. An unknown id throws
   * at creation.
   */
  startAt?: TStepId;
  /**
   * Expands into the persistence plugin, prepended to `plugins`. Combining it
   * with an explicit persistence plugin fails as a duplicate plugin name.
   */
  persist?: JourneyPersistOption;
  /**
   * Applied to navigation work and every async hook invocation. Work timeouts
   * block movement; post-commit hook timeouts surface as step errors.
   */
  defaultTimeoutMs?: number;
  plugins?: TPlugins;
};
