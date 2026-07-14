/**
 * Shared core contracts for `@rxova/journey-core`.
 *
 * The machine object holds only stable methods; every piece of changing state
 * lives in an immutable {@link JourneySnapshot} rebuilt at defined emission
 * points (navigation accepted → commit → settle, plus lifecycle and context
 * changes) and delivered to subscribers.
 */

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
 * - `blocked` — an `onLeave` guard returned `false`.
 * - `error` — an `onLeave` guard threw (or timed out).
 * - `transitioning` — another navigation's hook chain is still pending.
 * - `not-running` — the machine is idle, paused, completed, or terminated.
 * - `invalid-target` — unknown step id, or (graph) no transition targets it.
 * - `no-enabled-transition` — the event matched no enabled candidate.
 * - `out-of-bounds` — timeline move past its edge (back at index 0, forward at tip).
 * - `no-op` — navigation to the current position.
 * - `disposed` — the machine was disposed; all methods are safe no-ops.
 */
export type NavigationFailureReason =
  | "blocked"
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
  readonly phase: "leaving" | "entering" | null;
  readonly from: TStepId | null;
  readonly to: TStepId | null;
};

/** Async state of the current step's `onEnter`. */
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

/** Derived lifecycle booleans (`isLoading === transition.pending`). */
export type MachineFlags = {
  readonly isLoading: boolean;
  readonly isIdle: boolean;
  readonly isRunning: boolean;
  readonly isPaused: boolean;
  readonly isCompleted: boolean;
  readonly isTerminated: boolean;
};

/** Fields shared by every snapshot kind (discriminated on `type`). */
export type JourneySnapshotBase<TContext, TStepId extends string, TMeta> = {
  readonly status: JourneyStatus;
  readonly context: TContext;
  readonly transition: TransitionState<TStepId>;
  readonly history: JourneyHistoryState<TStepId>;
  readonly outcome: JourneyOutcome | null;
  readonly machine: MachineFlags;
  readonly plugins: Readonly<Record<string, unknown>>;
  readonly currentStep: CurrentStepBase<TStepId, TMeta> | null;
};

/** Linear snapshots carry declared-order derivations; graph fields don't exist. */
export type LinearSnapshot<TContext, TStepId extends string, TMeta> = Omit<
  JourneySnapshotBase<TContext, TStepId, TMeta>,
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

/** Graph snapshots carry enabled-transition derivations; order fields don't exist. */
export type GraphSnapshot<
  TContext,
  TStepId extends string,
  TMeta,
  TEvents extends JourneyEventObject = JourneyEventObject
> = Omit<JourneySnapshotBase<TContext, TStepId, TMeta>, "currentStep"> & {
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
  /** Events with at least one enabled candidate from the current step. */
  readonly availableEvents: readonly TEvents["type"][];
  /** Targets of enabled candidates from the current step. */
  readonly availableSteps: readonly TStepId[];
};

export type JourneySnapshot<
  TContext = unknown,
  TStepId extends string = string,
  TMeta = unknown,
  TEvents extends JourneyEventObject = JourneyEventObject
> = LinearSnapshot<TContext, TStepId, TMeta> | GraphSnapshot<TContext, TStepId, TMeta, TEvents>;

/** Context updater used by `machine.context.update` and hook args. */
export type ContextUpdater<TContext> = (previous: TContext) => TContext;

/**
 * Arguments passed to step hooks.
 *
 * `event` is the graph event that caused the transition; `null` for timeline
 * moves, linear navigation, and the initial entry on `start()`.
 * Context updates made inside hooks apply immediately and stick even when the
 * navigation is later cancelled.
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

/** `onLeave` may return `false` (sync or via promise) to cancel navigation. */
export type OnLeaveHook<
  TContext,
  TStepId extends string,
  TEvents extends JourneyEventObject = never,
  TSnap = JourneySnapshot<TContext, TStepId>
> = (
  args: StepHookArgs<TContext, TStepId, TEvents, TSnap>
) => boolean | void | Promise<boolean | void>;

/** `onEnter` is effect-only: fires after commit and cannot block. */
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
    readonly phase: "enter" | "transition" | "raise";
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
export type JourneyControls = {
  /** idle → running; enters the first/initial step. */
  start(): boolean;
  /** running → paused; navigation is rejected while paused. */
  pause(): boolean;
  /** paused → running. */
  resume(): boolean;
  /** running → completed. Explicit only — never fired by navigation. */
  complete(payload?: unknown): boolean;
  /** any → terminated. Wins over a pending transition. */
  terminate(payload?: unknown): boolean;
  /** completed | terminated → running; resets timeline + context to initial. */
  restart(): boolean;
};

export type JourneyNavigation<TStepId extends string> = {
  goToStepById(id: TStepId): Promise<NavigationResult<TStepId>>;
  /** Timeline pointer back `n`; clamps to start; fails only at index 0. */
  goToPreviousStep(n?: number): Promise<NavigationResult<TStepId>>;
  /** Timeline forward; linear falls back to next-in-declared-order at tip. */
  goToNextStep(): Promise<NavigationResult<TStepId>>;
  /** Pointer → timeline tip; fails if already there. */
  goToLastVisitedStep(): Promise<NavigationResult<TStepId>>;
};

/** Machine surface shared by linear and graph journeys. */
export type JourneyMachineBase<
  TContext,
  TStepId extends string,
  TSnap = JourneySnapshot<TContext, TStepId>
> = {
  getSnapshot(): TSnap;
  controls: JourneyControls;
  navigate: JourneyNavigation<TStepId>;
  subscriptions: JourneySubscriptions<TContext, TStepId, TSnap>;
  context: { update(updater: ContextUpdater<TContext>): void };
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

/** Runtime options shared by linear and graph journeys. */
export type JourneyRuntimeOptions<TPlugins extends readonly AnyJourneyPlugin[] = readonly []> = {
  /**
   * Defaults to `false`: subscribe-before-start is the natural order, so the
   * first `stepEnter` never fires before subscribers can attach.
   */
  autoStart?: boolean;
  /**
   * Applied to every async hook invocation; a timeout is treated as that hook
   * throwing (an `onLeave` timeout cancels navigation, an `onEnter` timeout
   * surfaces as a step error).
   */
  defaultTimeoutMs?: number;
  plugins?: TPlugins;
};
